import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MatchStatus, RequestStatus, UrgencyLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MatchAction } from './dto/respond-to-match.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BLOOD_COMPATIBILITY,
  CRITICAL_ESCALATION,
  STANDARD_ESCALATION,
  scoreMatch,
} from './matching.utils';

const BG_DISPLAY: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-',
};

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @InjectQueue('MATCH_REQUESTS') private readonly matchQueue: Queue,
  ) {}

  // ── Run matching for a request at given radius ────────────────────────────────

  async runMatching(requestId: string, radiusKm: number): Promise<void> {
    const request = await this.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      this.logger.warn(`runMatching: request ${requestId} not found`);
      return;
    }
    if (!([RequestStatus.PENDING, RequestStatus.PARTIALLY_FULFILLED] as RequestStatus[]).includes(request.status)) {
      this.logger.log(`runMatching: request ${requestId} is ${request.status}, skipping`);
      return;
    }
    if (!request.hospitalLat || !request.hospitalLng) {
      this.logger.warn(`runMatching: request ${requestId} has no location, skipping`);
      return;
    }

    const bgDisplay = BG_DISPLAY[request.bloodGroup];
    const compatibleGroups = BLOOD_COMPATIBILITY[bgDisplay] ?? [];
    if (compatibleGroups.length === 0) return;

    const radiusMeters = radiusKm * 1000;
    const lat = request.hospitalLat;
    const lng = request.hospitalLng;

    // BUG FIX #1 (BR-03): only VERIFIED donors appear in match results
    const donors = await this.prisma.$queryRaw<any[]>`
      SELECT
        dp.id AS "donorProfileId",
        u.id AS "userId",
        u.name,
        u."bloodGroup" AS "bloodGroup",
        u."verifStatus" AS "verifStatus",
        dp."totalDonations" AS "totalDonations",
        dp."responseRate" AS "responseRate",
        ST_Distance(
          dp.location,
          ST_GeogFromText('SRID=4326;POINT(' || ${lng}::float8 || ' ' || ${lat}::float8 || ')')
        ) / 1000.0 AS "distanceKm"
      FROM donor_profiles dp
      INNER JOIN users u ON u.id = dp."userId"
      WHERE
        dp.location IS NOT NULL
        AND dp."isAvailable" = true
        AND u."isBlocked" = false
        AND u."deletedAt" IS NULL
        AND u."verifStatus" = 'VERIFIED'
        AND u."bloodGroup" = ANY(${compatibleGroups}::"BloodGroup"[])
        AND (dp."lastDonationDate" IS NULL
             OR dp."lastDonationDate" <= NOW() - INTERVAL '56 days')
        AND ST_DWithin(
          dp.location,
          ST_GeogFromText('SRID=4326;POINT(' || ${lng}::float8 || ' ' || ${lat}::float8 || ')'),
          ${radiusMeters}::float8
        )
      ORDER BY "distanceKm" ASC
      LIMIT 50
    `;

    this.logger.log(`runMatching: request ${requestId} radius=${radiusKm}km found ${donors.length} donors`);

    const timeoutAt = new Date(Date.now() + 2 * 3600 * 1000); // 2-hour response window

    let newlyNotified = 0;
    for (const donor of donors) {
      const score = scoreMatch(donor.distanceKm, radiusKm, donor);
      const existing = await this.prisma.bloodMatch.findUnique({
        where: {
          requestId_donorProfileId: { requestId, donorProfileId: donor.donorProfileId },
        },
      });
      if (!existing) {
        const match = await this.prisma.bloodMatch.create({
          data: {
            requestId,
            donorProfileId: donor.donorProfileId,
            distanceKm: donor.distanceKm,
            score,
            timeoutAt,
          },
        });
        newlyNotified++;

        const bgDisp = BG_DISPLAY[request.bloodGroup] ?? request.bloodGroup;
        this.notifications.notifyMatchFound(
          donor.userId,
          requestId,
          match.id,
          bgDisp,
          request.hospitalName,
        ).catch((err) => this.logger.warn(`notify donor failed: ${err.message}`));
      }
    }

    this.logger.log(`runMatching: notified ${newlyNotified} new donors`);

    // BUG FIX #2 (BR-05): CRITICAL requests use a tighter escalation schedule
    const escalationTable = request.urgency === UrgencyLevel.CRITICAL
      ? CRITICAL_ESCALATION
      : STANDARD_ESCALATION;
    const stage = escalationTable.find(e => e.radius === radiusKm);
    if (!stage) {
      this.logger.warn(`runMatching: radius ${radiusKm}km not in escalation table for urgency=${request.urgency}`);
      return;
    }

    const totalNotified = await this.prisma.bloodMatch.count({ where: { requestId } });
    const shouldStop = totalNotified >= stage.threshold || stage.nextRadius === null;

    if (!shouldStop && stage.nextRadius) {
      this.logger.log(`runMatching: escalating to ${stage.nextRadius}km in ${stage.nextDelayMs}ms`);
      await this.matchQueue.add(
        'match',
        { requestId, radiusKm: stage.nextRadius },
        {
          delay: stage.nextDelayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }
  }

  // ── Donor responds to a match ────────────────────────────────────────────────

  async respondToMatch(matchId: string, donorUserId: string, action: MatchAction): Promise<object> {
    const donorProfile = await this.prisma.donorProfile.findUnique({
      where: { userId: donorUserId },
    });
    if (!donorProfile) throw new NotFoundException('Donor profile not found');

    const match = await this.prisma.bloodMatch.findFirst({
      where: { id: matchId, donorProfileId: donorProfile.id },
      include: { request: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== MatchStatus.NOTIFIED) {
      throw new BadRequestException(`Match already responded to (status: ${match.status})`);
    }

    const request = match.request;
    const donorUser = await this.prisma.user.findUnique({
      where: { id: donorUserId },
      select: { name: true },
    });

    if (action === MatchAction.ACCEPT) {
      await this.prisma.bloodMatch.update({
        where: { id: matchId },
        data: { status: MatchStatus.ACCEPTED, respondedAt: new Date() },
      });

      const accepted = await this.prisma.bloodMatch.count({
        where: { requestId: request.id, status: MatchStatus.ACCEPTED },
      });

      if (accepted >= request.unitsNeeded && request.status !== RequestStatus.FULFILLED) {
        await this.prisma.bloodRequest.update({
          where: { id: request.id },
          data: { status: RequestStatus.FULFILLED, unitsFulfilled: accepted },
        });
        this.notifications.notifyRequestFulfilled(request.receiverId, request.id)
          .catch((err) => this.logger.warn(`notify fulfilled failed: ${err.message}`));
      } else if (request.status === RequestStatus.PENDING) {
        await this.prisma.bloodRequest.update({
          where: { id: request.id },
          data: { status: RequestStatus.PARTIALLY_FULFILLED, unitsFulfilled: accepted },
        });
      }

      this.notifications.notifyMatchAccepted(request.receiverId, request.id, donorUser?.name ?? 'A donor')
        .catch((err) => this.logger.warn(`notify accepted failed: ${err.message}`));
    } else {
      await this.prisma.bloodMatch.update({
        where: { id: matchId },
        data: { status: MatchStatus.CANCELLED, respondedAt: new Date(), cancelReason: 'Donor declined' },
      });

      this.notifications.notifyMatchDeclined(request.receiverId, request.id)
        .catch((err) => this.logger.warn(`notify declined failed: ${err.message}`));
    }

    await this.updateResponseRate(donorProfile.id);

    return { success: true, action };
  }

  // ── Donor confirms donation actually happened ────────────────────────────────

  async confirmDonation(matchId: string, donorUserId: string): Promise<object> {
    const donorProfile = await this.prisma.donorProfile.findUnique({
      where: { userId: donorUserId },
      select: { id: true },
    });
    if (!donorProfile) throw new NotFoundException('Donor profile not found');

    const match = await this.prisma.bloodMatch.findFirst({
      where: { id: matchId, donorProfileId: donorProfile.id },
      include: { request: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== MatchStatus.ACCEPTED) {
      throw new BadRequestException(`Cannot confirm: match status is ${match.status}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.$transaction([
      this.prisma.bloodMatch.update({
        where: { id: matchId },
        data: { status: MatchStatus.DONATED, donatedAt: new Date() },
      }),
      this.prisma.donorProfile.update({
        where: { id: donorProfile.id },
        data: {
          totalDonations: { increment: 1 },
          livesSaved: { increment: 1 },
          lastDonationDate: today,
        },
      }),
      this.prisma.bloodRequest.update({
        where: { id: match.requestId },
        data: { unitsFulfilled: { increment: 1 } },
      }),
    ]);

    const updatedRequest = await this.prisma.bloodRequest.findUnique({
      where: { id: match.requestId },
      select: { unitsFulfilled: true, unitsNeeded: true, status: true, receiverId: true },
    });

    if (
      updatedRequest &&
      updatedRequest.unitsFulfilled >= updatedRequest.unitsNeeded &&
      updatedRequest.status !== RequestStatus.FULFILLED
    ) {
      await this.prisma.bloodRequest.update({
        where: { id: match.requestId },
        data: { status: RequestStatus.FULFILLED },
      });
      this.notifications.notifyRequestFulfilled(updatedRequest.receiverId, match.requestId)
        .catch((err) => this.logger.warn(`notify fulfilled failed: ${err.message}`));
    }

    return { success: true };
  }

  // ── Update donor response rate ────────────────────────────────────────────────

  private async updateResponseRate(donorProfileId: string): Promise<void> {
    const total = await this.prisma.bloodMatch.count({ where: { donorProfileId } });
    const responded = await this.prisma.bloodMatch.count({
      where: {
        donorProfileId,
        status: { in: [MatchStatus.ACCEPTED, MatchStatus.DONATED, MatchStatus.CANCELLED] },
        respondedAt: { not: null },
      },
    });
    const rate = total > 0 ? responded / total : 0;
    await this.prisma.donorProfile.update({
      where: { id: donorProfileId },
      data: { responseRate: rate },
    });
  }
}
