import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from './expo-push.service';
import { WebSocketModule } from '../websocket/websocket.module';

@Global()
@Module({
  imports: [WebSocketModule],
  providers: [NotificationsService, ExpoPushService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
