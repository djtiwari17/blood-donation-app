import {
  Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

const RECEIVER_ROLES: UserRole[] = [UserRole.RECEIVER, UserRole.DONOR_RECEIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN];

@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  createRequest(@CurrentUser() user: User, @Body() dto: CreateRequestDto) {
    if (!RECEIVER_ROLES.includes(user.role)) {
      throw new ForbiddenException('Only receivers can create blood requests');
    }
    return this.requestsService.createRequest(user.id, dto);
  }

  // /nearby and /mine MUST be before /:id to avoid route shadowing
  @Get('nearby')
  getNearbyRequests(
    @CurrentUser() user: User,
    @Query('radius') radius?: string,
  ) {
    return this.requestsService.getNearbyRequests(user.id, radius ? Number(radius) : 50);
  }

  @Get('mine')
  getMyRequests(@CurrentUser() user: User) {
    return this.requestsService.getMyRequests(user.id);
  }

  @Get(':id')
  getRequestById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.requestsService.getRequestById(id, user.id);
  }

  @Patch(':id/cancel')
  cancelRequest(@CurrentUser() user: User, @Param('id') id: string) {
    return this.requestsService.cancelRequest(user.id, id);
  }

  // Donor self-accepts a nearby request (free-accept model). The service
  // enforces donor-profile existence, blood compatibility and eligibility.
  @Post(':id/accept')
  acceptRequest(@CurrentUser() user: User, @Param('id') id: string) {
    return this.requestsService.acceptRequest(user.id, id);
  }

  @Get(':id/matches')
  getMatchesForRequest(@CurrentUser() user: User, @Param('id') id: string) {
    return this.requestsService.getMatchesForRequest(id, user.id);
  }
}
