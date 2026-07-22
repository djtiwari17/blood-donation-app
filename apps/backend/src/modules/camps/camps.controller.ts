import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Patch, Post, Query, UseGuards, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminRoleGuard } from '../admin/guards/admin-role.guard';
import { CampsService, CampStatus } from './camps.service';
import { CreateCampDto } from './dto/create-camp.dto';
import { UpdateCampDto } from './dto/update-camp.dto';

const CAMP_STATUSES: CampStatus[] = ['upcoming', 'ongoing', 'past'];

@UseGuards(JwtAuthGuard)
@Controller('camps')
export class CampsController {
  constructor(private readonly campsService: CampsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('status') status?: string) {
    const bucket = (status ?? 'upcoming') as CampStatus;
    if (!CAMP_STATUSES.includes(bucket)) {
      throw new BadRequestException(`status must be one of: ${CAMP_STATUSES.join(', ')}`);
    }
    return this.campsService.listCamps(user.id, bucket);
  }

  @Post(':id/join')
  join(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.campsService.joinCamp(user.id, id);
  }

  @Delete(':id/join')
  leave(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.campsService.leaveCamp(user.id, id);
  }
}

@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/camps')
export class AdminCampsController {
  constructor(private readonly campsService: CampsService) {}

  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.campsService.adminList(page, Math.min(limit, 100));
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateCampDto) {
    return this.campsService.createCamp(user.id, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampDto) {
    return this.campsService.updateCamp(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.campsService.deleteCamp(id);
  }
}
