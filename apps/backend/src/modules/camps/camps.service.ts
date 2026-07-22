import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCampDto } from './dto/create-camp.dto';
import { UpdateCampDto } from './dto/update-camp.dto';

export type CampStatus = 'upcoming' | 'ongoing' | 'past';

@Injectable()
export class CampsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── App-facing: list active camps by lifecycle bucket ────────────────────────

  async listCamps(userId: string, status: CampStatus = 'upcoming') {
    const now = new Date();
    const where: Prisma.CampWhereInput = { isActive: true };
    let orderBy: Prisma.CampOrderByWithRelationInput = { startTime: 'asc' };

    if (status === 'upcoming') {
      where.startTime = { gt: now };
    } else if (status === 'ongoing') {
      where.startTime = { lte: now };
      where.endTime = { gte: now };
    } else {
      where.endTime = { lt: now };
      orderBy = { endTime: 'desc' };
    }

    const camps = await this.prisma.camp.findMany({
      where,
      orderBy,
      include: {
        _count: { select: { registrations: true } },
        registrations: { where: { userId }, select: { id: true } },
      },
    });

    return camps.map(({ _count, registrations, ...c }) => ({
      ...c,
      attendeeCount: _count.registrations,
      isJoined: registrations.length > 0,
    }));
  }

  // ── App-facing: join / leave ─────────────────────────────────────────────────

  async joinCamp(userId: string, campId: string) {
    const camp = await this.prisma.camp.findUnique({ where: { id: campId } });
    if (!camp || !camp.isActive) throw new NotFoundException('Camp not found');
    if (camp.endTime < new Date()) {
      throw new BadRequestException('This camp has already ended.');
    }

    try {
      await this.prisma.campRegistration.create({ data: { campId, userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('You have already joined this camp.');
      }
      throw err;
    }
    return { success: true, joined: true };
  }

  async leaveCamp(userId: string, campId: string) {
    await this.prisma.campRegistration.deleteMany({ where: { campId, userId } });
    return { success: true, joined: false };
  }

  // ── Admin: CRUD ──────────────────────────────────────────────────────────────

  async adminList(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [camps, total] = await Promise.all([
      this.prisma.camp.findMany({
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { registrations: true } } },
      }),
      this.prisma.camp.count(),
    ]);

    return {
      camps: camps.map(({ _count, ...c }) => ({ ...c, attendeeCount: _count.registrations })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createCamp(adminId: string, dto: CreateCampDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (end <= start) {
      throw new BadRequestException('End time must be after start time.');
    }
    return this.prisma.camp.create({
      data: {
        name: dto.name,
        tagline: dto.tagline,
        description: dto.description,
        venue: dto.venue,
        address: dto.address,
        city: dto.city,
        lat: dto.lat,
        lng: dto.lng,
        startTime: start,
        endTime: end,
        organizer: dto.organizer,
        contactPhone: dto.contactPhone,
        createdById: adminId,
      },
    });
  }

  async updateCamp(campId: string, dto: UpdateCampDto) {
    const existing = await this.prisma.camp.findUnique({ where: { id: campId } });
    if (!existing) throw new NotFoundException('Camp not found');

    const start = dto.startTime ? new Date(dto.startTime) : existing.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : existing.endTime;
    if (end <= start) {
      throw new BadRequestException('End time must be after start time.');
    }

    return this.prisma.camp.update({
      where: { id: campId },
      data: {
        name: dto.name,
        tagline: dto.tagline,
        description: dto.description,
        venue: dto.venue,
        address: dto.address,
        city: dto.city,
        lat: dto.lat,
        lng: dto.lng,
        startTime: dto.startTime ? start : undefined,
        endTime: dto.endTime ? end : undefined,
        organizer: dto.organizer,
        contactPhone: dto.contactPhone,
        isActive: dto.isActive,
      },
    });
  }

  // Soft delete — hide from the app, preserve registrations/history.
  async deleteCamp(campId: string) {
    const existing = await this.prisma.camp.findUnique({ where: { id: campId } });
    if (!existing) throw new NotFoundException('Camp not found');
    await this.prisma.camp.update({ where: { id: campId }, data: { isActive: false } });
    return { success: true };
  }
}
