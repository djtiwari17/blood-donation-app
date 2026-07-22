import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { User } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
  ) {
    return this.notificationsService.findAll(user.id, page ? Number(page) : 1);
  }

  @Post('token')
  registerToken(@CurrentUser() user: User, @Body() dto: RegisterPushTokenDto) {
    return this.notificationsService.registerToken(user.id, dto.token, dto.platform);
  }

  @Delete('token')
  removeToken(@Body() dto: RegisterPushTokenDto) {
    return this.notificationsService.removeToken(dto.token);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user.id);
  }
}
