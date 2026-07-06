import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DonorsService } from './donors.service';
import { PrismaService } from '../../database/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';

const mockPrisma = {
  donorProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: { update: jest.fn() },
  $executeRaw: jest.fn(),
};

const mockGeocoding = { reverseGeocode: jest.fn() };

describe('DonorsService', () => {
  let service: DonorsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GeocodingService, useValue: mockGeocoding },
      ],
    }).compile();
    service = module.get(DonorsService);
  });

  // ── 56-day eligibility rule ──────────────────────────────────────────────────

  describe('isEligible', () => {
    it('returns true when no donation ever recorded', () => {
      expect(service.isEligible(null)).toBe(true);
    });

    it('returns false when last donation was 55 days ago', () => {
      const fiftyFiveDaysAgo = new Date(Date.now() - 55 * 86_400_000);
      expect(service.isEligible(fiftyFiveDaysAgo)).toBe(false);
    });

    it('returns true when last donation was exactly 56 days ago', () => {
      const fiftySixDaysAgo = new Date(Date.now() - 56 * 86_400_000);
      expect(service.isEligible(fiftySixDaysAgo)).toBe(true);
    });

    it('returns true when last donation was 100 days ago', () => {
      const hundredDaysAgo = new Date(Date.now() - 100 * 86_400_000);
      expect(service.isEligible(hundredDaysAgo)).toBe(true);
    });

    it('returns false on the day of donation (0 days)', () => {
      expect(service.isEligible(new Date())).toBe(false);
    });
  });

  // ── nextEligibleDate ──────────────────────────────────────────────────────────

  describe('nextEligibleDate', () => {
    it('is exactly 56 days after last donation', () => {
      const lastDonation = new Date('2024-01-01');
      const next = service.nextEligibleDate(lastDonation);
      const expected = new Date('2024-02-26'); // +56 days
      expect(next.toDateString()).toBe(expected.toDateString());
    });
  });

  // ── createProfile ─────────────────────────────────────────────────────────────

  describe('createProfile', () => {
    it('throws ConflictException if profile already exists', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.createProfile('user-id', {})).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates profile and returns with eligibility info', async () => {
      mockPrisma.donorProfile.findUnique
        .mockResolvedValueOnce(null) // existence check
        .mockResolvedValueOnce({    // getProfile call
          id: 'profile-id', userId: 'user-id', isAvailable: true,
          lastDonationDate: null, locationLat: null, locationLng: null,
          totalDonations: 0, livesSaved: 0, responseRate: 0,
        });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.donorProfile.create.mockResolvedValue({ id: 'profile-id' });

      const result = await service.createProfile('user-id', { isAvailable: true });
      expect(result).toMatchObject({ isEligible: true, nextEligibleDate: null });
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.donorProfile.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('user-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('includes eligibility data in response', async () => {
      const lastDonation = new Date(Date.now() - 30 * 86_400_000); // 30 days ago
      mockPrisma.donorProfile.findUnique.mockResolvedValue({
        id: 'p-id', userId: 'u-id', lastDonationDate: lastDonation, isAvailable: true,
        locationLat: null, locationLng: null, totalDonations: 2, livesSaved: 6, responseRate: 0.8,
      });

      const result = await service.getProfile('u-id');
      expect(result.isEligible).toBe(false); // 30 < 56 days
      expect(result.nextEligibleDate).toBeDefined();
    });
  });
});
