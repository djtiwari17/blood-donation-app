import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchStatus, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MatchingScheduler {
  private readonly logger = new Logger(MatchingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Expire requests past their expiresAt, cancel pending matches, notify receivers
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleRequests(): Promise<void> {
    const expired = await this.prisma.bloodRequest.findMany({
      where: {
        status: { in: [RequestStatus.PENDING, RequestStatus.PARTIALLY_FULFILLED] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true, receiverId: true },
    });

    if (expired.length === 0) return;

    const ids = expired.map(r => r.id);
    this.logger.log(`Expiring ${ids.length} stale requests`);

    await this.prisma.$transaction([
      this.prisma.bloodRequest.updateMany({
        where: { id: { in: ids } },
        data: { status: RequestStatus.EXPIRED },
      }),
      this.prisma.bloodMatch.updateMany({
        where: { requestId: { in: ids }, status: MatchStatus.NOTIFIED },
        data: { status: MatchStatus.CANCELLED, cancelReason: 'Request expired' },
      }),
    ]);

    // Notify each receiver (fire-and-forget)
    for (const req of expired) {
      this.notifications.notifyRequestExpired(req.receiverId, req.id)
        .catch((err) => this.logger.warn(`notify expired failed: ${err.message}`));
    }
  }

  // Time out matches that exceeded the 2-hour donor response window
  @Cron(CronExpression.EVERY_5_MINUTES)
  async timeoutStaleMatches(): Promise<void> {
    const timedOut = await this.prisma.bloodMatch.findMany({
      where: {
        status: MatchStatus.NOTIFIED,
        timeoutAt: { lt: new Date() },
      },
      select: { id: true, donorProfileId: true },
    });

    if (timedOut.length === 0) return;

    const ids = timedOut.map(m => m.id);
    this.logger.log(`Timing out ${ids.length} stale matches`);

    await this.prisma.bloodMatch.updateMany({
      where: { id: { in: ids } },
      data: { status: MatchStatus.TIMED_OUT },
    });

    // Update response rate for each affected donor
    const donorProfileIds = [...new Set(timedOut.map(m => m.donorProfileId))];
    for (const dpId of donorProfileIds) {
      const total = await this.prisma.bloodMatch.count({ where: { donorProfileId: dpId } });
      const responded = await this.prisma.bloodMatch.count({
        where: {
          donorProfileId: dpId,
          status: { in: [MatchStatus.ACCEPTED, MatchStatus.DONATED, MatchStatus.CANCELLED] },
          respondedAt: { not: null },
        },
      });
      await this.prisma.donorProfile.update({
        where: { id: dpId },
        data: { responseRate: total > 0 ? responded / total : 0 },
      });
    }
  }
}
