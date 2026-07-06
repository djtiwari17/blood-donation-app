import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { RequestsService } from './requests.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GeocodingService } from '../geocoding/geocoding.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  bloodRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  bloodMatch: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  donorProfile: {
    findUnique: jest.fn(),
  },
  $executeRaw: jest.fn().mockResolvedValue(1),
  $transaction: jest.fn().mockImplementation((ops: Promise<any>[]) => Promise.all(ops)),
};

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
};

const mockGeocoding = {
  geocode: jest.fn(),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-id' }),
};

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('RequestsService', () => {
  let service: RequestsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: GeocodingService, useValue: mockGeocoding },
        { provide: getQueueToken('MATCH_REQUESTS'), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(RequestsService);
  });

  // ── generateCode ────────────────────────────────────────────────────────────

  describe('generateCode (private, via reflection)', () => {
    it('matches format BD{MMDD}{6 hex uppercase chars}', () => {
      const code: string = (service as any).generateCode();
      expect(code).toMatch(/^BD\d{4}[0-9A-F]{6}$/);
    });

    it('generates unique codes on successive calls', () => {
      const codes = new Set(Array.from({ length: 100 }, () => (service as any).generateCode()));
      // Extremely unlikely for 100 calls with 16^6 = 16M random hex space to collide
      expect(codes.size).toBeGreaterThan(90);
    });

    it('month and day fields match current date', () => {
      const now = new Date();
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      const code: string = (service as any).generateCode();
      expect(code.slice(2, 4)).toBe(mm);
      expect(code.slice(4, 6)).toBe(dd);
    });
  });

  // ── createRequest — rate limit ───────────────────────────────────────────────

  describe('createRequest', () => {
    const validDto = {
      bloodGroup: 'A+',
      patientName: 'Ravi Kumar',
      hospitalName: 'AIIMS Delhi',
      hospitalLat: 28.5672,
      hospitalLng: 77.2100,
      unitsNeeded: 2,
      urgency: 'MEDIUM',
      requiredBy: new Date(Date.now() + 86400000).toISOString(),
    };

    it('throws 429 when request rate limit exceeded (>10/hour)', async () => {
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.expire.mockResolvedValue(1);
      await expect(service.createRequest('user-id', validDto as any))
        .rejects.toBeInstanceOf(HttpException);
    });

    it('enqueues match job at radius=10km for non-CRITICAL request', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.bloodRequest.create.mockResolvedValue({
        id: 'req-id',
        requestCode: 'BD061600ABCD',
        ...validDto,
        bloodGroup: 'A_POS',
      });

      await service.createRequest('user-id', { ...validDto, urgency: 'HIGH' } as any);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'match',
        { requestId: 'req-id', radiusKm: 10 },
        expect.any(Object),
      );
    });

    it('enqueues match job at radius=50km for CRITICAL request (Bug #2 fix)', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.bloodRequest.create.mockResolvedValue({
        id: 'req-id',
        requestCode: 'BD061600ABCD',
        ...validDto,
        urgency: 'CRITICAL',
        bloodGroup: 'A_POS',
      });

      await service.createRequest('user-id', { ...validDto, urgency: 'CRITICAL' } as any);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'match',
        { requestId: 'req-id', radiusKm: 50 },
        expect.any(Object),
      );
    });

    it('does NOT enqueue when no location available', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockGeocoding.geocode.mockResolvedValue(null);
      mockPrisma.bloodRequest.create.mockResolvedValue({
        id: 'req-id', requestCode: 'BD061600ABCD',
        bloodGroup: 'A_POS', hospitalLat: null, hospitalLng: null,
        urgency: 'LOW',
      });

      await service.createRequest('user-id', {
        ...validDto,
        hospitalLat: undefined,
        hospitalLng: undefined,
        hospitalAddress: 'Unknown Place',
      } as any);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  // ── getMatchesForRequest — phone masking (M-03) ──────────────────────────────

  describe('getMatchesForRequest — phone masking', () => {
    const REAL_PHONE = '+919876543210';

    function makeMatch(status: string) {
      return {
        id: `match-${status}`,
        status,
        distanceKm: 5,
        score: 85,
        notifiedAt: new Date(),
        respondedAt: null,
        donatedAt: null,
        timeoutAt: new Date(Date.now() + 3600000),
        donorProfile: {
          totalDonations: 2,
          user: {
            name: 'Donor Name',
            bloodGroup: 'A_POS',
            verifStatus: 'VERIFIED',
            phone: REAL_PHONE,
          },
        },
      };
    }

    beforeEach(() => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', receiverId: 'user-id',
      });
    });

    it('masks phone for NOTIFIED match: last 6 digits replaced with XXXXXX', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([makeMatch('NOTIFIED')]);

      const result = await service.getMatchesForRequest('req-id', 'user-id');
      const masked = result[0].donor.phone;

      expect(masked).toContain('XXXXXX');
      expect(masked).not.toBe(REAL_PHONE);
      // Last 6 digits replaced: '+919876543210' → '+919876XXXXXX'... wait: 543210 are last 6
      // +919876543210 → replace \d{6}$ → '+919876' + 'XXXXXX'
      expect(masked).toBe(REAL_PHONE.replace(/\d{6}$/, 'XXXXXX'));
    });

    it('reveals real phone for ACCEPTED match', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([makeMatch('ACCEPTED')]);

      const result = await service.getMatchesForRequest('req-id', 'user-id');

      expect(result[0].donor.phone).toBe(REAL_PHONE);
      expect(result[0].donor.phone).not.toContain('XXXXXX');
    });

    it('masks phone for DONATED match (information after fact — still masks for privacy)', async () => {
      mockPrisma.bloodMatch.findMany.mockResolvedValue([makeMatch('DONATED')]);

      const result = await service.getMatchesForRequest('req-id', 'user-id');

      // Only ACCEPTED reveals phone; DONATED is a different status
      expect(result[0].donor.phone).toContain('XXXXXX');
    });

    it('throws 403 when requester is not the request owner', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', receiverId: 'other-user-id',
      });

      await expect(service.getMatchesForRequest('req-id', 'user-id'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── cancelRequest ────────────────────────────────────────────────────────────

  describe('cancelRequest', () => {
    it('throws 404 when request not found', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue(null);
      await expect(service.cancelRequest('user-id', 'req-id'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when user is not the receiver', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', receiverId: 'other-user', status: 'PENDING',
      });
      await expect(service.cancelRequest('user-id', 'req-id'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 400 when request is already FULFILLED', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', receiverId: 'user-id', status: 'FULFILLED',
      });
      await expect(service.cancelRequest('user-id', 'req-id'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws 400 when request is EXPIRED', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', receiverId: 'user-id', status: 'EXPIRED',
      });
      await expect(service.cancelRequest('user-id', 'req-id'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('cancels PENDING request and all NOTIFIED matches', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', receiverId: 'user-id', status: 'PENDING',
      });
      mockPrisma.bloodRequest.update.mockResolvedValue({});
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.cancelRequest('user-id', 'req-id');

      expect(result).toMatchObject({ success: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('cancels PARTIALLY_FULFILLED request', async () => {
      mockPrisma.bloodRequest.findUnique.mockResolvedValue({
        id: 'req-id', receiverId: 'user-id', status: 'PARTIALLY_FULFILLED',
      });
      mockPrisma.bloodRequest.update.mockResolvedValue({});
      mockPrisma.bloodMatch.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.cancelRequest('user-id', 'req-id')).resolves.toMatchObject({ success: true });
    });
  });

  // ── getNearbyRequests ─────────────────────────────────────────────────────────

  describe('getNearbyRequests', () => {
    it('throws 404 when donor profile not found', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue(null);
      await expect(service.getNearbyRequests('user-id'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 400 when donor has no location set', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({
        userId: 'user-id', locationLat: null, locationLng: null,
        user: { bloodGroup: 'A_POS' },
      });
      await expect(service.getNearbyRequests('user-id'))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
