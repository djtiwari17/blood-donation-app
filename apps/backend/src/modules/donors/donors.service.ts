import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Gender, MatchStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { CreateDonorProfileDto } from './dto/create-donor-profile.dto';
import { UpdateDonorProfileDto } from './dto/update-donor-profile.dto';

const BG_DISPLAY: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-',
};

const DONATION_INTERVAL_DAYS = 56;

@Injectable()
export class DonorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
  ) {}

  // ── Create donor profile ─────────────────────────────────────────────────────

  async createProfile(userId: string, dto: CreateDonorProfileDto) {
    const existing = await this.prisma.donorProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Donor profile already exists');

    // Update User with additional fields collected during setup
    const userUpdates: Record<string, unknown> = {};
    if (dto.gender) userUpdates.gender = dto.gender as Gender;
    if (dto.dateOfBirth) userUpdates.dateOfBirth = new Date(dto.dateOfBirth);
    if (Object.keys(userUpdates).length) {
      await this.prisma.user.update({ where: { id: userId }, data: userUpdates });
    }

    const lastDonationDate = dto.lastDonationDate ? new Date(dto.lastDonationDate) : null;

    await this.prisma.donorProfile.create({
      data: {
        userId,
        isAvailable: dto.isAvailable ?? true,
        lastDonationDate,
        locationLat: dto.locationLat,
        locationLng: dto.locationLng,
      },
    });

    // Update PostGIS GEOGRAPHY column + reverse-geocode area
    if (dto.locationLat && dto.locationLng) {
      await this.prisma.$executeRaw`
        UPDATE donor_profiles
        SET location = ST_SetSRID(
          ST_MakePoint(${dto.locationLng}::float8, ${dto.locationLat}::float8),
          4326
        )::geography
        WHERE "userId" = ${userId}::uuid
      `;

      const area = await this.geocoding.reverseGeocode(dto.locationLat, dto.locationLng);
      if (area) {
        await this.prisma.user.update({ where: { id: userId }, data: { area } });
      }
    }

    return this.getProfile(userId);
  }

  // ── Get own donor profile ────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const profile = await this.prisma.donorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Donor profile not found');
    return this.withEligibility(profile);
  }

  // ── Update donor profile ─────────────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateDonorProfileDto) {
    const profile = await this.prisma.donorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Donor profile not found');

    const data: Record<string, unknown> = {};
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;
    if (dto.lastDonationDate !== undefined) data.lastDonationDate = new Date(dto.lastDonationDate);
    if (dto.locationLat !== undefined) data.locationLat = dto.locationLat;
    if (dto.locationLng !== undefined) data.locationLng = dto.locationLng;

    await this.prisma.donorProfile.update({ where: { userId }, data });

    if (dto.locationLat && dto.locationLng) {
      await this.prisma.$executeRaw`
        UPDATE donor_profiles
        SET location = ST_SetSRID(
          ST_MakePoint(${dto.locationLng}::float8, ${dto.locationLat}::float8),
          4326
        )::geography
        WHERE "userId" = ${userId}::uuid
      `;
      const area = await this.geocoding.reverseGeocode(dto.locationLat, dto.locationLng);
      if (area) {
        await this.prisma.user.update({ where: { id: userId }, data: { area } });
      }
    }

    return this.getProfile(userId);
  }

  // ── Donation history ────────────────────────────────────────────────────────

  async getDonationHistory(userId: string, page: number, limit: number) {
    const donorProfile = await this.prisma.donorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!donorProfile) throw new NotFoundException('Donor profile not found');

    const skip = (page - 1) * limit;
    const where = {
      donorProfileId: donorProfile.id,
      status: { in: [MatchStatus.DONATED, MatchStatus.CANCELLED, MatchStatus.TIMED_OUT] },
    };

    const [matches, total] = await Promise.all([
      this.prisma.bloodMatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { notifiedAt: 'desc' },
        include: {
          request: {
            select: { patientName: true, hospitalName: true, bloodGroup: true, urgency: true },
          },
        },
      }),
      this.prisma.bloodMatch.count({ where }),
    ]);

    return {
      matches: matches.map(m => ({
        ...m,
        request: {
          ...m.request,
          bloodGroup: BG_DISPLAY[m.request.bloodGroup as string] ?? m.request.bloodGroup,
        },
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private withEligibility(profile: any) {
    const eligible = this.isEligible(profile.lastDonationDate);
    const nextDate = profile.lastDonationDate
      ? this.nextEligibleDate(profile.lastDonationDate)
      : null;
    return { ...profile, isEligible: eligible, nextEligibleDate: nextDate };
  }

  isEligible(lastDonationDate: Date | null): boolean {
    if (!lastDonationDate) return true;
    const daysSince = Math.floor(
      (Date.now() - new Date(lastDonationDate).getTime()) / 86_400_000,
    );
    return daysSince >= DONATION_INTERVAL_DAYS;
  }

  nextEligibleDate(lastDonationDate: Date): Date {
    const d = new Date(lastDonationDate);
    d.setDate(d.getDate() + DONATION_INTERVAL_DAYS);
    return d;
  }
}
