import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { RespondToMatchDto } from './dto/respond-to-match.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('matches')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post(':id/respond')
  respondToMatch(
    @CurrentUser() user: User,
    @Param('id') matchId: string,
    @Body() dto: RespondToMatchDto,
  ) {
    return this.matchingService.respondToMatch(matchId, user.id, dto.action);
  }

  @Post(':id/confirm')
  confirmDonation(@CurrentUser() user: User, @Param('id') matchId: string) {
    return this.matchingService.confirmDonation(matchId, user.id);
  }
}
