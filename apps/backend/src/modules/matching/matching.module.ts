import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MatchingService } from './matching.service';
import { MatchingProcessor } from './matching.processor';
import { MatchingScheduler } from './matching.scheduler';
import { MatchingController } from './matching.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'MATCH_REQUESTS' }),
  ],
  providers: [MatchingService, MatchingProcessor, MatchingScheduler],
  controllers: [MatchingController],
  exports: [MatchingService],
})
export class MatchingModule {}
