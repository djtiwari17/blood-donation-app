import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DonorsService } from './donors.service';
import { CreateDonorProfileDto } from './dto/create-donor-profile.dto';
import { UpdateDonorProfileDto } from './dto/update-donor-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('donors')
export class DonorsController {
  constructor(private readonly donorsService: DonorsService) {}

  @Post('profile')
  createProfile(@CurrentUser() user: User, @Body() dto: CreateDonorProfileDto) {
    return this.donorsService.createProfile(user.id, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.donorsService.getProfile(user.id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateDonorProfileDto) {
    return this.donorsService.updateProfile(user.id, dto);
  }

  @Get('history')
  getDonationHistory(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.donorsService.getDonationHistory(user.id, page, Math.min(limit, 50));
  }
}
