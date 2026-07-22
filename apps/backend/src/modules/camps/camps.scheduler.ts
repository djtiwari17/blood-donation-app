import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CampsScheduler {
  private readonly logger = new Logger(CampsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Every day at 08:00, remind registrants of camps happening today.
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyCampReminders() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const camps = await this.prisma.camp.findMany({
      where: { isActive: true, startTime: { gte: dayStart, lte: dayEnd } },
      include: { registrations: { select: { userId: true } } },
    });

    let sent = 0;
    for (const camp of camps) {
      const time = camp.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      for (const reg of camp.registrations) {
        await this.notifications
          .notifyCampReminder(reg.userId, camp.id, camp.name, time)
          .catch(() => undefined);
        sent++;
      }
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} camp reminder(s) for ${camps.length} camp(s) today`);
    }
  }
}
