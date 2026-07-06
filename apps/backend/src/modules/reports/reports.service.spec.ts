import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  report: {
    create: jest.fn(),
  },
  donorProfile: {
    findUnique: jest.fn(),
  },
  bloodMatch: {
    updateMany: jest.fn(),
  },
};

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'app.rateLimit.reportPerDay') return 5;
    return undefined;
  }),
};

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  // ── Self-report guard ─────────────────────────────────────────────────────────

  describe('self-report', () => {
    it('throws 400 when reporter and reported are the same user', async () => {
      await expect(
        service.createReport('user-123', { reportedUserId: 'user-123', reason: 'SPAM' as any }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Should never touch Redis or DB
      expect(mockRedis.incr).not.toHaveBeenCalled();
      expect(mockPrisma.report.create).not.toHaveBeenCalled();
    });
  });

  // ── Daily rate limit (Blueprint §9.3: 5 reports/day/user) ────────────────────

  describe('daily rate limit', () => {
    it('allows up to 5 reports per day', async () => {
      mockRedis.incr.mockResolvedValue(5); // exactly at limit
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reported-id', reportCount: 0, verifStatus: 'VERIFIED',
      });
      mockPrisma.report.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ reportCount: 1 });

      await expect(
        service.createReport('reporter-id', { reportedUserId: 'reported-id', reason: 'SPAM' as any }),
      ).resolves.toMatchObject({ success: true });
    });

    it('throws 429 on the 6th report (exceeds limit of 5)', async () => {
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue(1);

      await expect(
        service.createReport('reporter-id', { reportedUserId: 'reported-id', reason: 'SPAM' as any }),
      ).rejects.toBeInstanceOf(HttpException);

      expect(mockPrisma.report.create).not.toHaveBeenCalled();
    });

    it('sets rate limit key TTL to 24 hours on first report', async () => {
      mockRedis.incr.mockResolvedValue(1); // first call of the day
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reported-id', reportCount: 0, verifStatus: 'UNVERIFIED',
      });
      mockPrisma.report.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ reportCount: 1 });

      await service.createReport('reporter-id', { reportedUserId: 'reported-id', reason: 'FAKE_PROFILE' as any });

      expect(mockRedis.expire).toHaveBeenCalledWith(
        `report:daily:reporter-id`,
        24 * 3600,
      );
    });
  });

  // ── Reported user validation ──────────────────────────────────────────────────

  describe('reported user validation', () => {
    it('throws 404 when reported user does not exist', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createReport('reporter-id', { reportedUserId: 'ghost-id', reason: 'SPAM' as any }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── Duplicate report prevention ───────────────────────────────────────────────

  describe('duplicate report prevention', () => {
    it('throws 409 when reporter already reported this user', async () => {
      mockRedis.incr.mockResolvedValue(2);
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reported-id', reportCount: 1, verifStatus: 'VERIFIED',
      });

      // Simulate Prisma P2002 unique constraint violation
      const p2002 = new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`reporterId`,`reportedId`)',
        { code: 'P2002', clientVersion: '5.0.0', meta: {} },
      );
      mockPrisma.report.create.mockRejectedValue(p2002);

      await expect(
        service.createReport('reporter-id', { reportedUserId: 'reported-id', reason: 'HARASSMENT' as any }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── Auto-suspend (BR-07: 3 reports → SUSPENDED) ──────────────────────────────

  describe('auto-suspend at threshold', () => {
    function setupReportSuccess(reportCount: number) {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reported-id', reportCount: reportCount - 1, verifStatus: 'VERIFIED',
      });
      mockPrisma.report.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ reportCount });
    }

    it('does NOT suspend when reportCount reaches 1', async () => {
      setupReportSuccess(1);

      await service.createReport('r1', { reportedUserId: 'reported-id', reason: 'SPAM' as any });

      const suspendCall = mockPrisma.user.update.mock.calls.find(
        (c: any[]) => c[0]?.data?.verifStatus === 'SUSPENDED',
      );
      expect(suspendCall).toBeUndefined();
    });

    it('does NOT suspend when reportCount reaches 2', async () => {
      setupReportSuccess(2);

      await service.createReport('r2', { reportedUserId: 'reported-id', reason: 'SPAM' as any });

      const suspendCall = mockPrisma.user.update.mock.calls.find(
        (c: any[]) => c[0]?.data?.verifStatus === 'SUSPENDED',
      );
      expect(suspendCall).toBeUndefined();
    });

    it('auto-suspends when reportCount reaches 3 (threshold)', async () => {
      setupReportSuccess(3);
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 2 });

      await service.createReport('r3', { reportedUserId: 'reported-id', reason: 'SPAM' as any });

      // Should call user.update to set SUSPENDED + isBlocked=true
      const suspendCall = mockPrisma.user.update.mock.calls.find(
        (c: any[]) => c[0]?.data?.verifStatus === 'SUSPENDED',
      );
      expect(suspendCall).toBeDefined();
      expect(suspendCall[0].data.isBlocked).toBe(true);
    });

    it('cancels all NOTIFIED matches when auto-suspending', async () => {
      setupReportSuccess(3);
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 2 });

      await service.createReport('r3', { reportedUserId: 'reported-id', reason: 'FAKE_PROFILE' as any });

      expect(mockPrisma.bloodMatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            donorProfileId: 'dp-id',
            status: 'NOTIFIED',
          }),
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('skips match cancellation when user has no donor profile', async () => {
      setupReportSuccess(3);
      mockPrisma.donorProfile.findUnique.mockResolvedValue(null); // receiver, no donor profile

      await service.createReport('r3', { reportedUserId: 'reported-id', reason: 'SPAM' as any });

      expect(mockPrisma.bloodMatch.updateMany).not.toHaveBeenCalled();
    });

    it('does not re-suspend an already SUSPENDED user', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reported-id', reportCount: 5, verifStatus: 'SUSPENDED', // already suspended
      });
      mockPrisma.report.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ reportCount: 6 });

      await service.createReport('r6', { reportedUserId: 'reported-id', reason: 'SPAM' as any });

      const suspendCall = mockPrisma.user.update.mock.calls.find(
        (c: any[]) => c[0]?.data?.verifStatus === 'SUSPENDED',
      );
      expect(suspendCall).toBeUndefined(); // no second suspend call
    });
  });
});
