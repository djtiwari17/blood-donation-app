import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'MATCH_REQUESTS' }),
  ],
  providers: [RequestsService],
  controllers: [RequestsController],
  exports: [RequestsService],
})
export class RequestsModule {}
