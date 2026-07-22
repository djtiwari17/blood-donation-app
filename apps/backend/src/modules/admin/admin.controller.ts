import {
  Body, Controller, DefaultValuePipe, Get, Ip, Param,
  ParseIntPipe, ParseUUIDPipe, Patch, Query, UseGuards,
} from '@nestjs/common';
import { ModerationStatus, RequestStatus, UserRole, VerifStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ModerateRequestDto } from './dto/moderate-request.dto';
import { User } from '@prisma/client';

@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('verifStatus') verifStatus?: VerifStatus,
  ) {
    return this.adminService.getUsers(page, Math.min(limit, 100), search, role, verifStatus);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(userId, dto);
  }

  @Get('requests')
  getRequests(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: RequestStatus,
    @Query('moderationStatus') moderationStatus?: ModerationStatus,
  ) {
    return this.adminService.getRequests(page, Math.min(limit, 100), status, moderationStatus);
  }

  @Get('requests/:id')
  getRequestDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getRequestDetail(id);
  }

  @Patch('requests/:id/moderate')
  moderateRequest(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateRequestDto,
    @Ip() ip: string,
  ) {
    return this.adminService.moderateRequest(admin.id, id, dto, ip);
  }

  @Get('reports')
  getReports(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unresolved', new DefaultValuePipe('true')) unresolved: string,
  ) {
    return this.adminService.getReports(page, Math.min(limit, 100), unresolved !== 'false');
  }

  @Patch('reports/:id/resolve')
  resolveReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.resolveReport(reportId, dto);
  }
}
