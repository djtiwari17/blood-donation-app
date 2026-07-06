import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FcmService } from './fcm.service';
import { WebSocketModule } from '../websocket/websocket.module';

@Global()
@Module({
  imports: [WebSocketModule],
  providers: [NotificationsService, FcmService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
