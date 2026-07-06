import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Custom Redis rate limit handles the per-user/per-day cap
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  createReport(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(user.id, dto);
  }
}
