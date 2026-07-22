import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BloodGroup, MatchStatus, ModerationStatus, RequestStatus, UrgencyLevel } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto } from './dto/create-request.dto';

const BG_MAP: Record<string, BloodGroup> = {
  'A+': BloodGroup.A_POS, 'A-': BloodGroup.A_NEG,
  'B+': BloodGroup.B_POS, 'B-': BloodGroup.B_NEG,
  'AB+': BloodGroup.AB_POS, 'AB-': BloodGroup.AB_NEG,
  'O+': BloodGroup.O_POS, 'O-': BloodGroup.O_NEG,
};

const BG_DISPLAY: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-',
};

// What blood groups can this donor type donate to (recipient types)
const DONOR_CAN_DONATE_TO: Record<string, string[]> = {
  'O-':  ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'O+':  ['A+', 'B+', 'O+', 'AB+'],
  'A-':  ['A+', 'A-', 'AB+', 'AB-'],
  'A+':  ['A+', 'AB+'],
  'B-':  ['B+', 'B-', 'AB+', 'AB-'],
  'B+':  ['B+', 'AB+'],
  'AB-': ['AB+', 'AB-'],
  'AB+': ['AB+'],
};

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geocoding: GeocodingService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @InjectQueue('MATCH_REQUESTS') private readonly matchQueue: Queue,
  ) {}

  // ── Create request ───────────────────────────────────────────────────────────

  async createRequest(userId: string, dto: CreateRequestDto) {
    const maxPerHour = 10;
    const rateKey = `req:rate:${userId}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) await this.redis.expire(rateKey, 3600);
    if (count > maxPerHour) {
      throw new HttpException('Too many requests. Please wait before creating another.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const bloodGroup = BG_MAP[dto.bloodGroup];
    if (!bloodGroup) throw new BadRequestException('Invalid blood group');

    let lat = dto.hospitalLat;
    let lng = dto.hospitalLng;

    if ((!lat || !lng) && dto.hospitalAddress) {
      const geo = await this.geocoding.geocode(dto.hospitalAddress);
      if (geo) { lat = geo.lat; lng = geo.lng; }
    }

    const requestCode = this.generateCode();
    const requiredBy = new Date(dto.requiredBy);
    // Expires 24 hours after required-by as a grace period
    const expiresAt = new Date(requiredBy.getTime() + 24 * 60 * 60 * 1000);

    // Moderation gate: in 'all_pending' mode every request waits for admin
    // approval before it reaches donors (and before matching runs).
    const autoApprove = this.config.get<string>('app.moderationMode') === 'auto_approve';
    const moderationStatus = autoApprove ? ModerationStatus.APPROVED : ModerationStatus.PENDING_REVIEW;

    const request = await this.prisma.bloodRequest.create({
      data: {
        requestCode,
        receiverId: userId,
        patientName: dto.patientName,
        hospitalName: dto.hospitalName,
        hospitalLat: lat,
        hospitalLng: lng,
        bloodGroup,
        unitsNeeded: dto.unitsNeeded,
        urgency: dto.urgency,
        requiredBy,
        expiresAt,
        moderationStatus,
      },
    });

    if (lat && lng) {
      await this.prisma.$executeRaw`
        UPDATE blood_requests
        SET "hospitalLocation" = ST_SetSRID(
          ST_MakePoint(${lng}::float8, ${lat}::float8),
          4326
        )::geography
        WHERE id = ${request.id}::uuid
      `;

      // Only kick off donor matching once the request is approved. Pending
      // requests are matched later, when an admin approves them.
      if (autoApprove) {
        // BUG FIX #2 (BR-05): CRITICAL requests start at 50km per Blueprint §4.2
        const startRadius = dto.urgency === UrgencyLevel.CRITICAL ? 50 : 10;
        await this.matchQueue.add('match', { requestId: request.id, radiusKm: startRadius }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        });
      }
    }

    return { ...request, bloodGroup: BG_DISPLAY[request.bloodGroup] ?? dto.bloodGroup };
  }

  // ── Get own requests (receiver) ──────────────────────────────────────────────

  async getMyRequests(userId: string) {
    const requests = await this.prisma.bloodRequest.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { matches: true } },
        matches: {
          where: { status: MatchStatus.ACCEPTED },
          select: { id: true },
        },
      },
    });

    return requests.map(r => ({
      ...r,
      bloodGroup: BG_DISPLAY[r.bloodGroup] ?? r.bloodGroup,
      totalMatches: r._count.matches,
      acceptedMatches: r.matches.length,
      _count: undefined,
      matches: undefined,
    }));
  }

  // ── Get request by ID ────────────────────────────────────────────────────────

  async getRequestById(requestId: string, requestingUserId: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');

    // Find donor profile for the requesting user, then check for their match
    const donorProfile = await this.prisma.donorProfile.findUnique({
      where: { userId: requestingUserId },
    });

    let myMatch: object | null = null;
    if (donorProfile) {
      const match = await this.prisma.bloodMatch.findUnique({
        where: { requestId_donorProfileId: { requestId, donorProfileId: donorProfile.id } },
      });
      if (match) {
        myMatch = {
          id: match.id,
          status: match.status,
          distanceKm: match.distanceKm,
          timeoutAt: match.timeoutAt,
        };
      }
    }

    // Phone reveal: the requester's number is exposed to the donor only once
    // their match is ACCEPTED (symmetric to the donor->receiver masking rule).
    let receiverPhone: string | null = null;
    if (myMatch && (myMatch as { status: MatchStatus }).status === MatchStatus.ACCEPTED) {
      const receiver = await this.prisma.user.findUnique({
        where: { id: request.receiverId },
        select: { phone: true },
      });
      receiverPhone = receiver?.phone ?? null;
    }

    return {
      ...request,
      bloodGroup: BG_DISPLAY[request.bloodGroup] ?? request.bloodGroup,
      myMatch,
      receiverPhone,
    };
  }

  // ── Donor self-accepts a nearby request (free-accept model) ──────────────────

  async acceptRequest(userId: string, requestId: string) {
    const donorProfile = await this.prisma.donorProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!donorProfile) {
      throw new NotFoundException('Donor profile not found. Complete your donor profile first.');
    }
    if (donorProfile.user.isBlocked) {
      throw new ForbiddenException('Your account cannot accept requests.');
    }

    const request = await this.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.moderationStatus !== ModerationStatus.APPROVED) {
      throw new BadRequestException('This request is pending review and not yet open for donors.');
    }
    if (!([RequestStatus.PENDING, RequestStatus.PARTIALLY_FULFILLED] as RequestStatus[]).includes(request.status)) {
      throw new BadRequestException(`This request is no longer open (status: ${request.status}).`);
    }
    if (request.expiresAt <= new Date()) {
      throw new BadRequestException('This request has expired.');
    }

    // Blood compatibility: the donor must be able to donate to the request's group.
    const donorBg = BG_DISPLAY[donorProfile.user.bloodGroup];
    const requestBg = BG_DISPLAY[request.bloodGroup];
    const canDonateTo = DONOR_CAN_DONATE_TO[donorBg] ?? [];
    if (!canDonateTo.includes(requestBg)) {
      throw new BadRequestException(
        `Your blood group (${donorBg}) is not compatible with this ${requestBg} request.`,
      );
    }

    // 56-day donation-interval eligibility.
    if (donorProfile.lastDonationDate) {
      const eligibleAt = new Date(donorProfile.lastDonationDate);
      eligibleAt.setDate(eligibleAt.getDate() + 56);
      if (eligibleAt > new Date()) {
        throw new BadRequestException('You are not yet eligible to donate again (56-day rule).');
      }
    }

    const existing = await this.prisma.bloodMatch.findUnique({
      where: { requestId_donorProfileId: { requestId, donorProfileId: donorProfile.id } },
    });
    // Idempotent: already committed to this request.
    if (existing && (existing.status === MatchStatus.ACCEPTED || existing.status === MatchStatus.DONATED)) {
      return this.buildAcceptResult(existing.id, existing.status, request.id, request.receiverId);
    }

    // Distance donor -> hospital (best-effort; both need a location).
    let distanceKm = 0;
    if (donorProfile.locationLat && donorProfile.locationLng && request.hospitalLat && request.hospitalLng) {
      const rows = await this.prisma.$queryRaw<{ km: number }[]>`
        SELECT ST_Distance(
          ST_GeogFromText('SRID=4326;POINT(' || ${donorProfile.locationLng}::float8 || ' ' || ${donorProfile.locationLat}::float8 || ')'),
          ST_GeogFromText('SRID=4326;POINT(' || ${request.hospitalLng}::float8 || ' ' || ${request.hospitalLat}::float8 || ')')
        ) / 1000.0 AS km
      `;
      distanceKm = rows[0]?.km ?? 0;
    }
    const score = Math.max(10, 100 - Math.min(distanceKm, 90));
    const timeoutAt = new Date(Date.now() + 2 * 3600 * 1000);

    const match = existing
      ? await this.prisma.bloodMatch.update({
          where: { id: existing.id },
          data: { status: MatchStatus.ACCEPTED, respondedAt: new Date(), distanceKm, score, timeoutAt, cancelReason: null },
        })
      : await this.prisma.bloodMatch.create({
          data: { requestId, donorProfileId: donorProfile.id, status: MatchStatus.ACCEPTED, respondedAt: new Date(), distanceKm, score, timeoutAt },
        });

    // Roll up request fulfillment.
    const accepted = await this.prisma.bloodMatch.count({
      where: { requestId, status: MatchStatus.ACCEPTED },
    });
    if (accepted >= request.unitsNeeded && request.status !== RequestStatus.FULFILLED) {
      await this.prisma.bloodRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.FULFILLED, unitsFulfilled: accepted },
      });
      this.notifications.notifyRequestFulfilled(request.receiverId, requestId).catch(() => undefined);
    } else if (request.status === RequestStatus.PENDING) {
      await this.prisma.bloodRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.PARTIALLY_FULFILLED, unitsFulfilled: accepted },
      });
    }

    this.notifications
      .notifyMatchAccepted(request.receiverId, requestId, donorProfile.user.name)
      .catch(() => undefined);

    return this.buildAcceptResult(match.id, MatchStatus.ACCEPTED, request.id, request.receiverId);
  }

  private async buildAcceptResult(matchId: string, status: MatchStatus, requestId: string, receiverId: string) {
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { phone: true },
    });
    return { matchId, status, requestId, receiverPhone: receiver?.phone ?? null };
  }

  // ── Cancel request ───────────────────────────────────────────────────────────

  async cancelRequest(userId: string, requestId: string) {
    const request = await this.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.receiverId !== userId) throw new ForbiddenException('Not your request');
    if (!([RequestStatus.PENDING, RequestStatus.PARTIALLY_FULFILLED] as RequestStatus[]).includes(request.status)) {
      throw new BadRequestException(`Cannot cancel a request with status ${request.status}`);
    }

    await this.prisma.$transaction([
      this.prisma.bloodRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.CANCELLED },
      }),
      this.prisma.bloodMatch.updateMany({
        where: { requestId, status: MatchStatus.NOTIFIED },
        data: { status: MatchStatus.CANCELLED, cancelReason: 'Request cancelled by receiver' },
      }),
    ]);

    return { success: true };
  }

  // ── Get matches for a request (receiver view, with phone masking) ─────────────

  async getMatchesForRequest(requestId: string, requesterId: string) {
    const request = await this.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.receiverId !== requesterId) throw new ForbiddenException('Not your request');

    const matches = await this.prisma.bloodMatch.findMany({
      where: { requestId },
      orderBy: { score: 'desc' },
      include: {
        donorProfile: {
          include: { user: true },
        },
      },
    });

    return matches.map(m => ({
      id: m.id,
      status: m.status,
      distanceKm: m.distanceKm,
      score: m.score,
      notifiedAt: m.notifiedAt,
      respondedAt: m.respondedAt,
      donatedAt: m.donatedAt,
      timeoutAt: m.timeoutAt,
      donor: {
        name: m.donorProfile.user.name,
        bloodGroup: BG_DISPLAY[m.donorProfile.user.bloodGroup] ?? m.donorProfile.user.bloodGroup,
        verifStatus: m.donorProfile.user.verifStatus,
        totalDonations: m.donorProfile.totalDonations,
        // Phone masking: only reveal when ACCEPTED
        phone: m.status === MatchStatus.ACCEPTED
          ? m.donorProfile.user.phone
          : m.donorProfile.user.phone.replace(/\d{6}$/, 'XXXXXX'),
      },
    }));
  }

  // ── Get nearby open requests (donor view, PostGIS) ───────────────────────────

  async getNearbyRequests(userId: string, radiusKm = 50) {
    const donorProfile = await this.prisma.donorProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!donorProfile) throw new NotFoundException('Donor profile not found');
    if (!donorProfile.locationLat || !donorProfile.locationLng) {
      throw new BadRequestException('Donor location not set. Update your profile first.');
    }

    const lat = donorProfile.locationLat;
    const lng = donorProfile.locationLng;
    const radiusMeters = radiusKm * 1000;

    const donorBgDisplay = BG_DISPLAY[donorProfile.user.bloodGroup];
    const recipientGroups = DONOR_CAN_DONATE_TO[donorBgDisplay] ?? [];

    if (recipientGroups.length === 0) {
      return [];
    }

    // Cache key based on donor location (4dp) + blood group. Only the raw
    // request rows are cached; per-donor match state is merged fresh below so
    // an Accept reflects immediately (30s cache would otherwise be stale).
    const cacheKey = `nearby-req:${lat.toFixed(4)}:${lng.toFixed(4)}:${donorBgDisplay}`;
    let rows: any[];
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      rows = JSON.parse(cached);
    } else {
      rows = await this.prisma.$queryRaw<any[]>`
        SELECT
          br.id,
          br."requestCode",
          br."receiverId",
          br."patientName",
          br."hospitalName",
          br."hospitalLat",
          br."hospitalLng",
          br."bloodGroup",
          br."unitsNeeded",
          br."unitsFulfilled",
          br.urgency,
          br."requiredBy",
          br."expiresAt",
          br.status,
          br."isVerified",
          br."createdAt",
          ST_Distance(
            br."hospitalLocation",
            ST_GeogFromText('SRID=4326;POINT(' || ${lng}::float8 || ' ' || ${lat}::float8 || ')')
          ) / 1000.0 AS "distanceKm"
        FROM blood_requests br
        WHERE
          br."hospitalLocation" IS NOT NULL
          AND br.status IN ('PENDING', 'PARTIALLY_FULFILLED')
          AND br."moderationStatus" = 'APPROVED'
          AND br."expiresAt" > NOW()
          AND br."bloodGroup" = ANY(${recipientGroups}::"BloodGroup"[])
          AND ST_DWithin(
            br."hospitalLocation",
            ST_GeogFromText('SRID=4326;POINT(' || ${lng}::float8 || ' ' || ${lat}::float8 || ')'),
            ${radiusMeters}::float8
          )
        ORDER BY "distanceKm" ASC
        LIMIT 50
      `;
      await this.redis.setex(cacheKey, 30, JSON.stringify(rows));
    }

    // Merge this donor's match state (fresh) + reveal requester phone once ACCEPTED.
    const requestIds = rows.map((r) => r.id);
    const matchByReq = new Map<string, { id: string; status: MatchStatus; distanceKm: number; timeoutAt: Date }>();
    if (requestIds.length) {
      const matches = await this.prisma.bloodMatch.findMany({
        where: { donorProfileId: donorProfile.id, requestId: { in: requestIds } },
        select: { id: true, requestId: true, status: true, distanceKm: true, timeoutAt: true },
      });
      for (const m of matches) {
        matchByReq.set(m.requestId, { id: m.id, status: m.status, distanceKm: m.distanceKm, timeoutAt: m.timeoutAt });
      }
    }

    const acceptedReceiverIds = rows
      .filter((r) => matchByReq.get(r.id)?.status === MatchStatus.ACCEPTED)
      .map((r) => r.receiverId);
    const phoneByReceiver = new Map<string, string>();
    if (acceptedReceiverIds.length) {
      const receivers = await this.prisma.user.findMany({
        where: { id: { in: acceptedReceiverIds } },
        select: { id: true, phone: true },
      });
      for (const u of receivers) phoneByReceiver.set(u.id, u.phone);
    }

    const urgencyRank = (u: string) =>
      u === 'CRITICAL' ? 0 : u === 'HIGH' ? 1 : u === 'MEDIUM' ? 2 : 3;

    return rows
      .map((r) => {
        const m = matchByReq.get(r.id) ?? null;
        const { receiverId, ...rest } = r;
        return {
          ...rest,
          myMatch: m ? { id: m.id, status: m.status, distanceKm: m.distanceKm, timeoutAt: m.timeoutAt } : null,
          receiverPhone: m?.status === MatchStatus.ACCEPTED ? (phoneByReceiver.get(receiverId) ?? null) : null,
        };
      })
      // Emergency (CRITICAL/HIGH) sorted to the top, then nearest first.
      .sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency) || a.distanceKm - b.distanceKm);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private generateCode(): string {
    const now = new Date();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const hex = randomBytes(3).toString('hex').toUpperCase();
    return `BD${mm}${dd}${hex}`;
  }
}
