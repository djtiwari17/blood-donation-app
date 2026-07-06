import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BloodGroup, MatchStatus, RequestStatus, UrgencyLevel } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GeocodingService } from '../geocoding/geocoding.service';
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
      },
    });

    if (lat && lng) {
      await this.prisma.$executeRaw`
        UPDATE blood_requests
        SET hospital_location = ST_SetSRID(
          ST_MakePoint(${lng}::float8, ${lat}::float8),
          4326
        )::geography
        WHERE id = ${request.id}::uuid
      `;

      // BUG FIX #2 (BR-05): CRITICAL requests start at 50km per Blueprint §4.2
      const startRadius = dto.urgency === UrgencyLevel.CRITICAL ? 50 : 10;
      await this.matchQueue.add('match', { requestId: request.id, radiusKm: startRadius }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
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

    return {
      ...request,
      bloodGroup: BG_DISPLAY[request.bloodGroup] ?? request.bloodGroup,
      myMatch,
    };
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

    // Cache key based on donor location (4dp) + blood group
    const cacheKey = `nearby-req:${lat.toFixed(4)}:${lng.toFixed(4)}:${donorBgDisplay}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        br.id,
        br.request_code AS "requestCode",
        br.patient_name AS "patientName",
        br.hospital_name AS "hospitalName",
        br.hospital_lat AS "hospitalLat",
        br.hospital_lng AS "hospitalLng",
        br.blood_group AS "bloodGroup",
        br.units_needed AS "unitsNeeded",
        br.units_fulfilled AS "unitsFulfilled",
        br.urgency,
        br.required_by AS "requiredBy",
        br.expires_at AS "expiresAt",
        br.status,
        br.created_at AS "createdAt",
        ST_Distance(
          br.hospital_location,
          ST_GeogFromText('SRID=4326;POINT(' || ${lng}::float8 || ' ' || ${lat}::float8 || ')')
        ) / 1000.0 AS "distanceKm"
      FROM blood_requests br
      WHERE
        br.hospital_location IS NOT NULL
        AND br.status IN ('PENDING', 'PARTIALLY_FULFILLED')
        AND br.expires_at > NOW()
        AND br.blood_group = ANY(${recipientGroups}::blood_group[])
        AND ST_DWithin(
          br.hospital_location,
          ST_GeogFromText('SRID=4326;POINT(' || ${lng}::float8 || ' ' || ${lat}::float8 || ')'),
          ${radiusMeters}::float8
        )
      ORDER BY "distanceKm" ASC
      LIMIT 50
    `;

    await this.redis.setex(cacheKey, 30, JSON.stringify(rows));
    return rows;
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
