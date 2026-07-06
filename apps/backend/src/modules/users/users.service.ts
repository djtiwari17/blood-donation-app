import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Gender } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { donorProfile: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletedAt, ...safe } = user;
    return safe;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.area !== undefined) data.area = dto.area;
    if (dto.fcmToken !== undefined) data.fcmToken = dto.fcmToken;
    if (dto.gender !== undefined) data.gender = dto.gender as Gender;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = new Date(dto.dateOfBirth);

    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletedAt, ...safe } = updated;
    return safe;
  }
}
