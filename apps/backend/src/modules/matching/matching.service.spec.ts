import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { MatchingService } from './matching.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BLOOD_COMPATIBILITY,
  CRITICAL_ESCALATION,
  STANDARD_ESCALATION,
  scoreMatch,
} from './matching.utils';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  bloodRequest: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bloodMatch: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  donorProfile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn().mockImplementation((ops: Promise<any>[]) => Promise.all(ops)),
};

const mockNotifications = {
  notifyMatchFound: jest.fn().mockResolvedValue(undefined),
  notifyMatchAccepted: jest.fn().mockResolvedValue(undefined),
  notifyMatchDeclined: jest.fn().mockResolvedValue(undefined),
  notifyRequestFulfilled: jest.fn().mockResolvedValue(undefined),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-id' }),
};

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('BLOOD_COMPATIBILITY matrix — all 64 ABO/Rh combinations', () => {
  const ALL_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  // Truth table: MATRIX[recipient][donor] = true if compatible
  const MATRIX: Record<string, Record<string, boolean>> = {
    'A+':  { 'A+': true,  'A-': true,  'B+': false, 'B-': false, 'AB+': false, 'AB-': false, 'O+': true,  'O-': true  },
    'A-':  { 'A+': false, 'A-': true,  'B+': false, 'B-': false, 'AB+': false, 'AB-': false, 'O+': false, 'O-': true  },
    'B+':  { 'A+': false, 'A-': false, 'B+': true,  'B-': true,  'AB+': false, 'AB-': false, 'O+': true,  'O-': true  },
    'B-':  { 'A+': false, 'A-': false, 'B+': false, 'B-': true,  'AB+': false, 'AB-': false, 'O+': false, 'O-': true  },
    'AB+': { 'A+': true,  'A-': true,  'B+': true,  'B-': true,  'AB+': true,  'AB-': true,  'O+': true,  'O-': true  },
    'AB-': { 'A+': false, 'A-': true,  'B+': false, 'B-': true,  'AB+': false, 'AB-': true,  'O+': false, 'O-': true  },
    'O+':  { 'A+': false, 'A-': false, 'B+': false, 'B-': false, 'AB+': false, 'AB-': false, 'O+': true,  'O-': true  },
    'O-':  { 'A+': false, 'A-': false, 'B+': false, 'B-': false, 'AB+': false, 'AB-': false, 'O+': false, 'O-': true  },
  };

  const cases: [string, string, boolean][] = [];
  for (const recipient of ALL_GROUPS) {
    for (const donor of ALL_GROUPS) {
      cases.push([recipient, donor, MATRIX[recipient][donor]]);
    }
  }

  it.each(cases)(
    'recipient=%s donor=%s compatible=%s',
    (recipient, donor, expected) => {
      const compatible = BLOOD_COMPATIBILITY[recipient];
      if (expected) {
        expect(compatible).toContain(donor);
      } else {
        expect(compatible).not.toContain(donor);
      }
    },
  );

  it('covers all 8 recipient blood groups', () => {
    expect(Object.keys(BLOOD_COMPATIBILITY).sort()).toEqual(ALL_GROUPS.sort());
  });

  it('AB+ accepts all 8 donor types (universal recipient)', () => {
    expect(BLOOD_COMPATIBILITY['AB+'].sort()).toEqual(ALL_GROUPS.sort());
  });

  it('O- accepts only O- (most restrictive recipient)', () => {
    expect(BLOOD_COMPATIBILITY['O-']).toEqual(['O-']);
  });
});

// ── scoreMatch ──────────────────────────────────────────────────────────────────

describe('scoreMatch — composite 0–100 formula', () => {
  const PERFECT = { totalDonations: 6, responseRate: 1.0, verifStatus: 'VERIFIED' };

  it('perfect donor at origin scores 100', () => {
    expect(scoreMatch(0, 50, PERFECT)).toBe(100);
    // 40(dist) + 20(avail) + 20(verif) + 10(exp) + 10(rate) = 100
  });

  it('donor at exact radius edge: distance score = 0', () => {
    // distanceScore = max(0, 40 - floor(50/50 * 40)) = max(0, 0) = 0
    expect(scoreMatch(50, 50, PERFECT)).toBe(60); // 0+20+20+10+10
  });

  it('donor at half radius: distance score = 20', () => {
    // distanceScore = max(0, 40 - floor(25/50 * 40)) = 40-20 = 20
    expect(scoreMatch(25, 50, PERFECT)).toBe(80); // 20+20+20+10+10
  });

  it('distance beyond radius is clamped to 0 (never negative)', () => {
    // distanceScore = max(0, 40 - floor(200/50 * 40)) = max(0, -120) = 0
    expect(scoreMatch(200, 50, { totalDonations: 0, responseRate: 0, verifStatus: 'UNVERIFIED' })).toBe(20);
    // 0+20+0+0+0 = 20 (availScore always present)
  });

  it('VERIFIED donor: verifScore = 20', () => {
    expect(scoreMatch(0, 50, { totalDonations: 0, responseRate: 0, verifStatus: 'VERIFIED' })).toBe(80);
  });

  it('PENDING donor: verifScore = 10', () => {
    expect(scoreMatch(0, 50, { totalDonations: 0, responseRate: 0, verifStatus: 'PENDING' })).toBe(70);
  });

  it('UNVERIFIED donor: verifScore = 0', () => {
    expect(scoreMatch(0, 50, { totalDonations: 0, responseRate: 0, verifStatus: 'UNVERIFIED' })).toBe(60);
  });

  it('experience tier boundaries: 0→4→7→10 pts at 0/1/3/6 donations', () => {
    const base = { responseRate: 0, verifStatus: 'VERIFIED' };
    expect(scoreMatch(0, 50, { totalDonations: 0, ...base })).toBe(80); // 40+20+20+0+0
    expect(scoreMatch(0, 50, { totalDonations: 1, ...base })).toBe(84); // +4
    expect(scoreMatch(0, 50, { totalDonations: 3, ...base })).toBe(87); // +7
    expect(scoreMatch(0, 50, { totalDonations: 6, ...base })).toBe(90); // +10
  });

  it('response rate: 0%=0pts, 50%=5pts, 100%=10pts', () => {
    const base = { totalDonations: 0, verifStatus: 'VERIFIED' };
    expect(scoreMatch(0, 50, { responseRate: 0,   ...base })).toBe(80);
    expect(scoreMatch(0, 50, { responseRate: 0.5, ...base })).toBe(85);
    expect(scoreMatch(0, 50, { responseRate: 1.0, ...base })).toBe(90);
  });

  it('never exceeds 100', () => {
    expect(scoreMatch(0, 50, PERFECT)).toBeLessThanOrEqual(100);
  });

  it('score ordering: closer donor ranks higher (same other attrs)', () => {
    const donor = { totalDonations: 3, responseRate: 0.8, verifStatus: 'VERIFIED' };
    const near = scoreMatch(5,  50, donor);
    const far  = scoreMatch(45, 50, donor);
    expect(near).toBeGreaterThan(far);
  });
});

// ── Escalation schedules ──────────────────────────────────────────────────────

describe('STANDARD_ESCALATION', () => {
  it('starts at 10km', () => {
    expect(STANDARD_ESCALATION[0].radius).toBe(10);
  });

  it('ends at 200km with no further escalation', () => {
    const last = STANDARD_ESCALATION[STANDARD_ESCALATION.length - 1];
    expect(last.radius).toBe(200);
    expect(last.nextRadius).toBeNull();
  });

  it('progression: 10→25→50→100→200', () => {
    expect(STANDARD_ESCALATION.map(e => e.radius)).toEqual([10, 25, 50, 100, 200]);
  });

  it('10km threshold is 3: escalates if fewer than 3 matches', () => {
    const s = STANDARD_ESCALATION.find(e => e.radius === 10)!;
    expect(s.threshold).toBe(3);
    expect(s.nextRadius).toBe(25);
    expect(s.nextDelayMs).toBe(2 * 3600 * 1000);
  });
});

describe('CRITICAL_ESCALATION (Blueprint §4.2)', () => {
  it('starts at 50km, not 10km', () => {
    expect(CRITICAL_ESCALATION[0].radius).toBe(50);
    expect(CRITICAL_ESCALATION.find(e => e.radius === 10)).toBeUndefined();
  });

  it('jumps to 200km at T+30min', () => {
    const s = CRITICAL_ESCALATION.find(e => e.radius === 50)!;
    expect(s.nextRadius).toBe(200);
    expect(s.nextDelayMs).toBe(30 * 60 * 1000);
  });

  it('threshold at 50km is 1: escalates even with 0 matches', () => {
    const s = CRITICAL_ESCALATION.find(e => e.radius === 50)!;
    expect(s.threshold).toBe(1);
  });
});

// ── MatchingService.runMatching ───────────────────────────────────────────────

describe('MatchingService', () => {
  let service: MatchingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: getQueueToken('MATCH_REQUESTS'), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(MatchingService);
  });

  describe('runMatching', () => {
    it('returns early when request not found', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue(null);
      await service.runMatching('req-id', 10);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns early when request is EXPIRED', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({ status: 'EXPIRED' });
      await service.runMatching('req-id', 10);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns early when request has no location', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        status: 'PENDING', hospitalLat: null, hospitalLng: null, urgency: 'HIGH',
      });
      await service.runMatching('req-id', 10);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('escalates from 10km to 25km when below threshold (standard request)', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', status: 'PENDING',
        hospitalLat: 12.9, hospitalLng: 77.6,
        bloodGroup: 'A_POS', hospitalName: 'Test Hospital',
        urgency: 'HIGH',
      });
      mockPrisma.$queryRaw.mockResolvedValue([]); // no donors found
      mockPrisma.bloodMatch.count.mockResolvedValue(0); // 0 total matches

      await service.runMatching('req-id', 10);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'match',
        { requestId: 'req-id', radiusKm: 25 },
        expect.objectContaining({ delay: 2 * 3600 * 1000 }),
      );
    });

    it('does NOT escalate when total matches >= threshold', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', status: 'PENDING',
        hospitalLat: 12.9, hospitalLng: 77.6,
        bloodGroup: 'A_POS', hospitalName: 'Test Hospital',
        urgency: 'HIGH',
      });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.bloodMatch.count.mockResolvedValue(3); // meets threshold of 3 at 10km

      await service.runMatching('req-id', 10);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('CRITICAL at 50km escalates to 200km at T+30min', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', status: 'PENDING',
        hospitalLat: 12.9, hospitalLng: 77.6,
        bloodGroup: 'A_POS', hospitalName: 'Test Hospital',
        urgency: 'CRITICAL',
      });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.bloodMatch.count.mockResolvedValue(0);

      await service.runMatching('req-id', 50);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'match',
        { requestId: 'req-id', radiusKm: 200 },
        expect.objectContaining({ delay: 30 * 60 * 1000 }),
      );
    });

    it('CRITICAL at 10km: unknown stage → warns, does NOT enqueue', async () => {
      // CRITICAL escalation has no 10km stage; passing 10km is a misconfiguration
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', status: 'PENDING',
        hospitalLat: 12.9, hospitalLng: 77.6,
        bloodGroup: 'A_POS', hospitalName: 'Test Hospital',
        urgency: 'CRITICAL',
      });
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.runMatching('req-id', 10);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('creates match record and notifies donor for each new candidate', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', status: 'PENDING',
        hospitalLat: 12.9, hospitalLng: 77.6,
        bloodGroup: 'A_POS', hospitalName: 'Test Hospital',
        receiverId: 'recv-id', urgency: 'MEDIUM',
      });
      mockPrisma.$queryRaw.mockResolvedValue([{
        donorProfileId: 'dp-1', userId: 'u-1',
        distanceKm: 5, verifStatus: 'VERIFIED',
        totalDonations: 3, responseRate: 0.8,
      }]);
      mockPrisma.bloodMatch.findUnique.mockResolvedValue(null); // no existing match
      mockPrisma.bloodMatch.create.mockResolvedValue({ id: 'match-1' });
      mockPrisma.bloodMatch.count.mockResolvedValue(1); // after creation, 1 total

      await service.runMatching('req-id', 10);

      expect(mockPrisma.bloodMatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: 'req-id',
            donorProfileId: 'dp-1',
          }),
        }),
      );
      expect(mockNotifications.notifyMatchFound).toHaveBeenCalledWith(
        'u-1', 'req-id', 'match-1', expect.any(String), 'Test Hospital',
      );
    });

    it('skips duplicate: does not re-notify existing match', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', status: 'PENDING',
        hospitalLat: 12.9, hospitalLng: 77.6,
        bloodGroup: 'A_POS', hospitalName: 'Test Hospital',
        urgency: 'LOW',
      });
      mockPrisma.$queryRaw.mockResolvedValue([{
        donorProfileId: 'dp-1', userId: 'u-1',
        distanceKm: 5, verifStatus: 'VERIFIED',
        totalDonations: 1, responseRate: 0.5,
      }]);
      mockPrisma.bloodMatch.findUnique.mockResolvedValue({ id: 'existing-match' }); // already notified
      mockPrisma.bloodMatch.count.mockResolvedValue(1);

      await service.runMatching('req-id', 10);

      expect(mockPrisma.bloodMatch.create).not.toHaveBeenCalled();
      expect(mockNotifications.notifyMatchFound).not.toHaveBeenCalled();
    });
  });

  // ── respondToMatch ────────────────────────────────────────────────────────────

  describe('respondToMatch', () => {
    it('throws 404 when donor profile not found', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue(null);
      await expect(service.respondToMatch('match-id', 'user-id', 'ACCEPT' as any))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 when match not found for this donor', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue(null);
      await expect(service.respondToMatch('match-id', 'user-id', 'ACCEPT' as any))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 400 when match already responded to', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue({
        id: 'match-id', status: 'ACCEPTED',
        request: { id: 'req-id', receiverId: 'recv-id', unitsNeeded: 1, status: 'PENDING' },
      });
      await expect(service.respondToMatch('match-id', 'user-id', 'ACCEPT' as any))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('ACCEPT: updates match to ACCEPTED and updates response rate', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue({
        id: 'match-id', status: 'NOTIFIED',
        request: { id: 'req-id', receiverId: 'recv-id', unitsNeeded: 2, status: 'PENDING' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Ravi Kumar' });
      mockPrisma.bloodMatch.update.mockResolvedValue({});
      mockPrisma.bloodMatch.count
        .mockResolvedValueOnce(1) // accepted count = 1 (< unitsNeeded=2)
        .mockResolvedValueOnce(5) // total for response rate
        .mockResolvedValueOnce(4); // responded for response rate
      mockPrisma.bloodRequest.update.mockResolvedValue({});
      mockPrisma.donorProfile.update.mockResolvedValue({});

      const result = await service.respondToMatch('match-id', 'user-id', 'ACCEPT' as any);

      expect(result).toMatchObject({ success: true });
      expect(mockPrisma.bloodMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }),
      );
      expect(mockPrisma.bloodRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_FULFILLED' }) }),
      );
    });

    it('ACCEPT: marks request FULFILLED when accepted count >= unitsNeeded', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue({
        id: 'match-id', status: 'NOTIFIED',
        request: { id: 'req-id', receiverId: 'recv-id', unitsNeeded: 1, status: 'PENDING' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Priya' });
      mockPrisma.bloodMatch.update.mockResolvedValue({});
      mockPrisma.bloodMatch.count
        .mockResolvedValueOnce(1)  // accepted = 1 >= unitsNeeded 1 → FULFILLED
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);
      mockPrisma.bloodRequest.update.mockResolvedValue({});
      mockPrisma.donorProfile.update.mockResolvedValue({});

      await service.respondToMatch('match-id', 'user-id', 'ACCEPT' as any);

      expect(mockPrisma.bloodRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FULFILLED' }) }),
      );
    });

    it('DECLINE: updates match to CANCELLED', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue({
        id: 'match-id', status: 'NOTIFIED',
        request: { id: 'req-id', receiverId: 'recv-id', unitsNeeded: 1, status: 'PENDING' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Donor' });
      mockPrisma.bloodMatch.update.mockResolvedValue({});
      mockPrisma.bloodMatch.count.mockResolvedValue(0).mockResolvedValue(0);
      mockPrisma.donorProfile.update.mockResolvedValue({});

      await service.respondToMatch('match-id', 'user-id', 'DECLINE' as any);

      expect(mockPrisma.bloodMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    });
  });

  // ── confirmDonation ───────────────────────────────────────────────────────────

  describe('confirmDonation', () => {
    it('throws 404 when donor profile not found', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue(null);
      await expect(service.confirmDonation('match-id', 'user-id'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 400 when match status is not ACCEPTED', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue({
        id: 'match-id', status: 'NOTIFIED',
        requestId: 'req-id', request: { id: 'req-id' },
      });
      await expect(service.confirmDonation('match-id', 'user-id'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('records donation: updates match, donorProfile, and request in a transaction', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue({
        id: 'match-id', status: 'ACCEPTED',
        requestId: 'req-id', request: { id: 'req-id', receiverId: 'recv-id' },
      });
      mockPrisma.bloodMatch.update.mockResolvedValue({});
      mockPrisma.donorProfile.update.mockResolvedValue({});
      mockPrisma.bloodRequest.update.mockResolvedValue({});
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        unitsFulfilled: 1, unitsNeeded: 2, status: 'PARTIALLY_FULFILLED', receiverId: 'recv-id',
      });

      const result = await service.confirmDonation('match-id', 'user-id');

      expect(result).toMatchObject({ success: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Verify the donorProfile update increments totalDonations and sets lastDonationDate
      expect(mockPrisma.donorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalDonations: { increment: 1 },
            lastDonationDate: expect.any(Date),
          }),
        }),
      );
    });

    it('marks request FULFILLED after confirming the last needed unit', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'dp-id' });
      mockPrisma.bloodMatch.findFirst.mockResolvedValue({
        id: 'match-id', status: 'ACCEPTED',
        requestId: 'req-id', request: { id: 'req-id', receiverId: 'recv-id' },
      });
      mockPrisma.bloodMatch.update.mockResolvedValue({});
      mockPrisma.donorProfile.update.mockResolvedValue({});
      mockPrisma.bloodRequest.update.mockResolvedValue({});
      // After $transaction, unitsFulfilled reached unitsNeeded
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        unitsFulfilled: 2, unitsNeeded: 2, status: 'PARTIALLY_FULFILLED', receiverId: 'recv-id',
      });

      await service.confirmDonation('match-id', 'user-id');

      // Second bloodRequest.update should be FULFILLED
      const calls = mockPrisma.bloodRequest.update.mock.calls;
      const fulfilledCall = calls.find((c: any[]) =>
        c[0]?.data?.status === 'FULFILLED'
      );
      expect(fulfilledCall).toBeDefined();
    });
  });
});
