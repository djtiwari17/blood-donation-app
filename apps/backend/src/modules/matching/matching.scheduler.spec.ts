import { Test, TestingModule } from '@nestjs/testing';
import { MatchingScheduler } from './matching.scheduler';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  bloodRequest: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  bloodMatch: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  donorProfile: {
    update: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((ops: Promise<any>[]) => Promise.all(ops)),
};

const mockNotifications = {
  notifyRequestExpired: jest.fn().mockResolvedValue(undefined),
};

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('MatchingScheduler', () => {
  let scheduler: MatchingScheduler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    scheduler = module.get(MatchingScheduler);
  });

  // ── expireStaleRequests ───────────────────────────────────────────────────────

  describe('expireStaleRequests', () => {
    it('does nothing when no stale requests found', async () => {
      mockPrisma.bloodRequest.findMany.mockResolvedValue([]);

      await scheduler.expireStaleRequests();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockNotifications.notifyRequestExpired).not.toHaveBeenCalled();
    });

    it('marks stale requests EXPIRED and cancels their NOTIFIED matches', async () => {
      const staleRequests = [
        { id: 'req-1', receiverId: 'recv-1' },
        { id: 'req-2', receiverId: 'recv-2' },
      ];
      mockPrisma.bloodRequest.findMany.mockResolvedValue(staleRequests);
      mockPrisma.bloodRequest.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 5 });

      await scheduler.expireStaleRequests();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      const [ops] = mockPrisma.$transaction.mock.calls[0];
      // Both request update and match update should be in the transaction
      expect(ops).toHaveLength(2);
    });

    it('notifies each receiver whose request expired', async () => {
      mockPrisma.bloodRequest.findMany.mockResolvedValue([
        { id: 'req-1', receiverId: 'recv-1' },
        { id: 'req-2', receiverId: 'recv-2' },
      ]);
      mockPrisma.bloodRequest.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 0 });

      await scheduler.expireStaleRequests();

      expect(mockNotifications.notifyRequestExpired).toHaveBeenCalledTimes(2);
      expect(mockNotifications.notifyRequestExpired).toHaveBeenCalledWith('recv-1', 'req-1');
      expect(mockNotifications.notifyRequestExpired).toHaveBeenCalledWith('recv-2', 'req-2');
    });

    it('queries for PENDING and PARTIALLY_FULFILLED requests past expiresAt', async () => {
      mockPrisma.bloodRequest.findMany.mockResolvedValue([]);

      await scheduler.expireStaleRequests();

      expect(mockPrisma.bloodRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: expect.arrayContaining(['PENDING', 'PARTIALLY_FULFILLED']) },
            expiresAt: { lt: expect.any(Date) },
          }),
        }),
      );
    });
  });

  // ── timeoutStaleMatches ───────────────────────────────────────────────────────

  describe('timeoutStaleMatches', () => {
    it('does nothing when no timed-out matches found', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([]);

      await scheduler.timeoutStaleMatches();

      expect(mockPrisma.bloodMatch.updateMany).not.toHaveBeenCalled();
    });

    it('marks timed-out NOTIFIED matches as TIMED_OUT', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([
        { id: 'match-1', donorProfileId: 'dp-1' },
        { id: 'match-2', donorProfileId: 'dp-1' },
      ]);
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.bloodMatch.count.mockResolvedValue(5).mockResolvedValue(5); // total
      mockPrisma.donorProfile.update.mockResolvedValue({});

      await scheduler.timeoutStaleMatches();

      expect(mockPrisma.bloodMatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['match-1', 'match-2'] },
          }),
          data: { status: 'TIMED_OUT' },
        }),
      );
    });

    it('recalculates response rate for each affected donor', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([
        { id: 'match-1', donorProfileId: 'dp-1' },
        { id: 'match-2', donorProfileId: 'dp-2' }, // two different donors
      ]);
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.bloodMatch.count
        .mockResolvedValueOnce(10)  // dp-1 total
        .mockResolvedValueOnce(7)   // dp-1 responded
        .mockResolvedValueOnce(5)   // dp-2 total
        .mockResolvedValueOnce(2);  // dp-2 responded
      mockPrisma.donorProfile.update.mockResolvedValue({});

      await scheduler.timeoutStaleMatches();

      // Should update response rate for both unique donors
      expect(mockPrisma.donorProfile.update).toHaveBeenCalledTimes(2);
    });

    it('deduplicates donor IDs when multiple matches belong to same donor', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([
        { id: 'match-1', donorProfileId: 'dp-1' },
        { id: 'match-2', donorProfileId: 'dp-1' }, // same donor
        { id: 'match-3', donorProfileId: 'dp-1' }, // same donor
      ]);
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.bloodMatch.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      mockPrisma.donorProfile.update.mockResolvedValue({});

      await scheduler.timeoutStaleMatches();

      // dp-1 appears 3 times but response rate should only be computed once
      expect(mockPrisma.donorProfile.update).toHaveBeenCalledTimes(1);
    });

    it('sets responseRate to 0 when donor has no matches', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([
        { id: 'match-1', donorProfileId: 'dp-new' },
      ]);
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.bloodMatch.count
        .mockResolvedValueOnce(0)  // total = 0
        .mockResolvedValueOnce(0); // responded = 0
      mockPrisma.donorProfile.update.mockResolvedValue({});

      await scheduler.timeoutStaleMatches();

      expect(mockPrisma.donorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { responseRate: 0 },
        }),
      );
    });
  });
});
