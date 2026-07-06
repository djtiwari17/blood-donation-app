import {
  Injectable, Logger, BadRequestException,
  ConflictException, NotFoundException, HttpException, HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MatchStatus, Prisma, VerifStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateReportDto } from './dto/create-report.dto';

const AUTO_SUSPEND_THRESHOLD = 3;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async createReport(reporterId: string, dto: CreateReportDto): Promise<object> {
    if (reporterId === dto.reportedUserId) {
      throw new BadRequestException('You cannot report yourself');
    }

    // Redis rate limit: N reports per 24 hours per user
    const limitKey = `report:daily:${reporterId}`;
    const current = await this.redis.incr(limitKey);
    if (current === 1) await this.redis.expire(limitKey, 24 * 3600);

    const maxPerDay = this.config.get<number>('app.rateLimit.reportPerDay') ?? 5;
    if (current > maxPerDay) {
      throw new HttpException('Daily report limit reached. Try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Verify reported user exists
    const reported = await this.prisma.user.findUnique({
      where: { id: dto.reportedUserId },
      select: { id: true, reportCount: true, verifStatus: true },
    });
    if (!reported) throw new NotFoundException('User not found');

    // Create report — unique constraint [reporterId, reportedId] prevents duplicates
    try {
      await this.prisma.report.create({
        data: {
          reporterId,
          reportedId: dto.reportedUserId,
          reason: dto.reason,
          details: dto.details,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You have already reported this user');
      }
      throw err;
    }

    // Increment report counter on the reported user
    const updated = await this.prisma.user.update({
      where: { id: dto.reportedUserId },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true },
    });

    // Auto-suspend when threshold reached
    if (updated.reportCount >= AUTO_SUSPEND_THRESHOLD && reported.verifStatus !== VerifStatus.SUSPENDED) {
      await this.prisma.user.update({
        where: { id: dto.reportedUserId },
        data: { verifStatus: VerifStatus.SUSPENDED, isBlocked: true },
      });

      // Cancel all pending matches for this donor
      const donorProfile = await this.prisma.donorProfile.findUnique({
        where: { userId: dto.reportedUserId },
        select: { id: true },
      });
      if (donorProfile) {
        await this.prisma.bloodMatch.updateMany({
          where: { donorProfileId: donorProfile.id, status: MatchStatus.NOTIFIED },
          data: { status: MatchStatus.CANCELLED, cancelReason: 'Account suspended' },
        });
      }

      this.logger.warn(`User ${dto.reportedUserId} auto-suspended after ${updated.reportCount} reports`);
    }

    return { success: true };
  }
}
