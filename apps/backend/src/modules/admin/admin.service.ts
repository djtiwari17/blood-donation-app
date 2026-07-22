import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MatchStatus, ModerationStatus, RequestStatus, UrgencyLevel, UserRole, VerifStatus,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ModerateRequestDto, ModerationAction } from './dto/moderate-request.dto';

// Auto-flag a requester once they hit this many fake-request strikes.
const FAKE_STRIKE_THRESHOLD = 3;
// Window used by the "too many requests too fast" suspicion heuristic.
const RECENT_WINDOW_HOURS = 24;

const BG_DISPLAY: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-',
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('MATCH_REQUESTS') private readonly matchQueue: Queue,
  ) {}

  // ── Dashboard stats ──────────────────────────────────────────────────────────

  async getStats() {
    const [
      totalUsers,
      totalDonors,
      activeRequests,
      pendingVerifications,
      openReports,
      donationAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, role: { not: UserRole.ADMIN } } }),
      this.prisma.donorProfile.count(),
      this.prisma.bloodRequest.count({
        where: { status: { in: [RequestStatus.PENDING, RequestStatus.PARTIALLY_FULFILLED] } },
      }),
      this.prisma.user.count({ where: { verifStatus: VerifStatus.PENDING, deletedAt: null } }),
      this.prisma.report.count({ where: { resolvedAt: null } }),
      this.prisma.donorProfile.aggregate({ _sum: { totalDonations: true } }),
    ]);

    return {
      totalUsers,
      totalDonors,
      activeRequests,
      pendingVerifications,
      openReports,
      totalDonations: donationAgg._sum.totalDonations ?? 0,
    };
  }

  // ── Users ────────────────────────────────────────────────────────────────────

  async getUsers(
    page = 1,
    limit = 20,
    search?: string,
    role?: UserRole,
    verifStatus?: VerifStatus,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      role: role ?? { not: UserRole.SUPER_ADMIN },
      ...(verifStatus && { verifStatus }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          bloodGroup: true,
          role: true,
          verifStatus: true,
          isBlocked: true,
          reportCount: true,
          city: true,
          createdAt: true,
          donorProfile: { select: { totalDonations: true, isAvailable: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(u => ({
        ...u,
        bloodGroup: BG_DISPLAY[u.bloodGroup] ?? u.bloodGroup,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.verifStatus !== undefined && { verifStatus: dto.verifStatus }),
        ...(dto.isBlocked !== undefined && { isBlocked: dto.isBlocked }),
      },
      select: {
        id: true, name: true, verifStatus: true, isBlocked: true,
      },
    });
  }

  // ── Blood Requests ───────────────────────────────────────────────────────────

  async getRequests(
    page = 1,
    limit = 20,
    status?: RequestStatus,
    moderationStatus?: ModerationStatus,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      ...(status && { status }),
      ...(moderationStatus && { moderationStatus }),
    };

    const [requests, total] = await Promise.all([
      this.prisma.bloodRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          requestCode: true,
          patientName: true,
          hospitalName: true,
          bloodGroup: true,
          urgency: true,
          status: true,
          moderationStatus: true,
          isVerified: true,
          isFake: true,
          rejectionReason: true,
          unitsNeeded: true,
          unitsFulfilled: true,
          requiredBy: true,
          createdAt: true,
          receiver: {
            select: { id: true, name: true, phone: true, strikeCount: true, isFlagged: true },
          },
          _count: { select: { matches: true } },
        },
      }),
      this.prisma.bloodRequest.count({ where }),
    ]);

    return {
      requests: requests.map(({ _count, ...r }) => ({
        ...r,
        bloodGroup: BG_DISPLAY[r.bloodGroup] ?? r.bloodGroup,
        totalMatches: _count.matches,
        // Surface a quick suspicion signal for the queue.
        suspicious: r.receiver.isFlagged || r.receiver.strikeCount > 0,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Full request + requester trust history for the fake-verification view.
  async getRequestDetail(requestId: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: requestId },
      include: {
        receiver: {
          select: { id: true, name: true, phone: true, verifStatus: true, strikeCount: true, isFlagged: true, createdAt: true },
        },
        _count: { select: { matches: true } },
      },
    });
    if (!request) throw new NotFoundException('Request not found');

    const since = new Date(Date.now() - RECENT_WINDOW_HOURS * 3600 * 1000);
    const [totalRequests, fulfilled, rejected, fake, recentRequests] = await Promise.all([
      this.prisma.bloodRequest.count({ where: { receiverId: request.receiverId } }),
      this.prisma.bloodRequest.count({ where: { receiverId: request.receiverId, status: RequestStatus.FULFILLED } }),
      this.prisma.bloodRequest.count({ where: { receiverId: request.receiverId, moderationStatus: ModerationStatus.REJECTED } }),
      this.prisma.bloodRequest.count({ where: { receiverId: request.receiverId, isFake: true } }),
      this.prisma.bloodRequest.count({ where: { receiverId: request.receiverId, createdAt: { gte: since } } }),
    ]);

    const { _count, ...rest } = request;
    return {
      ...rest,
      bloodGroup: BG_DISPLAY[request.bloodGroup] ?? request.bloodGroup,
      totalMatches: _count.matches,
      requesterHistory: {
        totalRequests,
        fulfilledRequests: fulfilled,
        rejectedRequests: rejected,
        fakeRequests: fake,
        strikeCount: request.receiver.strikeCount,
        isFlagged: request.receiver.isFlagged,
        recentRequests,
        recentWindowHours: RECENT_WINDOW_HOURS,
      },
    };
  }

  async moderateRequest(adminId: string, requestId: string, dto: ModerateRequestDto, ip?: string) {
    const request = await this.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    const now = new Date();
    const base = { moderatedById: adminId, moderatedAt: now };
    let auditAction = '';
    let flaggedUser = false;

    switch (dto.action) {
      case ModerationAction.APPROVE:
        await this.prisma.bloodRequest.update({
          where: { id: requestId },
          data: { ...base, moderationStatus: ModerationStatus.APPROVED },
        });
        await this.enqueueMatch(request);
        auditAction = 'REQUEST_APPROVED';
        break;

      case ModerationAction.VERIFY:
        await this.prisma.bloodRequest.update({
          where: { id: requestId },
          data: { ...base, moderationStatus: ModerationStatus.APPROVED, isVerified: true },
        });
        await this.enqueueMatch(request);
        auditAction = 'REQUEST_VERIFIED';
        break;

      case ModerationAction.REJECT:
        await this.prisma.bloodRequest.update({
          where: { id: requestId },
          data: { ...base, moderationStatus: ModerationStatus.REJECTED, rejectionReason: dto.reason ?? null },
        });
        await this.cancelPendingMatches(requestId, 'Request rejected by admin');
        auditAction = 'REQUEST_REJECTED';
        break;

      case ModerationAction.MARK_FAKE: {
        await this.prisma.bloodRequest.update({
          where: { id: requestId },
          data: {
            ...base,
            moderationStatus: ModerationStatus.REJECTED,
            isFake: true,
            rejectionReason: dto.reason ?? 'Marked as fake / spam',
          },
        });
        await this.cancelPendingMatches(requestId, 'Request marked as fake by admin');
        const updated = await this.prisma.user.update({
          where: { id: request.receiverId },
          data: { strikeCount: { increment: 1 } },
          select: { strikeCount: true },
        });
        if (updated.strikeCount >= FAKE_STRIKE_THRESHOLD) {
          await this.prisma.user.update({ where: { id: request.receiverId }, data: { isFlagged: true } });
          flaggedUser = true;
        }
        auditAction = 'REQUEST_MARKED_FAKE';
        break;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: auditAction,
        entity: 'BloodRequest',
        entityId: requestId,
        meta: { reason: dto.reason ?? null, requesterId: request.receiverId, flaggedUser },
        ipAddress: ip,
      },
    });

    return { success: true, action: dto.action, flaggedUser };
  }

  private async enqueueMatch(request: { id: string; hospitalLat: number | null; hospitalLng: number | null; status: RequestStatus; urgency: UrgencyLevel }) {
    if (!request.hospitalLat || !request.hospitalLng) return;
    if (!([RequestStatus.PENDING, RequestStatus.PARTIALLY_FULFILLED] as RequestStatus[]).includes(request.status)) return;
    const startRadius = request.urgency === UrgencyLevel.CRITICAL ? 50 : 10;
    await this.matchQueue.add('match', { requestId: request.id, radiusKm: startRadius }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async cancelPendingMatches(requestId: string, reason: string) {
    await this.prisma.bloodMatch.updateMany({
      where: { requestId, status: MatchStatus.NOTIFIED },
      data: { status: MatchStatus.CANCELLED, cancelReason: reason },
    });
  }

  // ── Reports ──────────────────────────────────────────────────────────────────

  async getReports(page = 1, limit = 20, unresolved = true) {
    const skip = (page - 1) * limit;
    const where = unresolved ? { resolvedAt: null } : {};

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reason: true,
          details: true,
          resolvedAt: true,
          resolution: true,
          createdAt: true,
          reporter: { select: { id: true, name: true, phone: true } },
          reported: { select: { id: true, name: true, phone: true, verifStatus: true, reportCount: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async resolveReport(reportId: string, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    return this.prisma.report.update({
      where: { id: reportId },
      data: { resolvedAt: new Date(), resolution: dto.resolution },
      select: { id: true, resolvedAt: true, resolution: true },
    });
  }
}
