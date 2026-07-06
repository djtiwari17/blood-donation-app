import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestStatus, UserRole, VerifStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

const BG_DISPLAY: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-',
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getRequests(page = 1, limit = 20, status?: RequestStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

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
          unitsNeeded: true,
          unitsFulfilled: true,
          requiredBy: true,
          createdAt: true,
          receiver: { select: { id: true, name: true, phone: true } },
          _count: { select: { matches: true } },
        },
      }),
      this.prisma.bloodRequest.count({ where }),
    ]);

    return {
      requests: requests.map(r => ({
        ...r,
        bloodGroup: BG_DISPLAY[r.bloodGroup] ?? r.bloodGroup,
        totalMatches: r._count.matches,
        _count: undefined,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
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
