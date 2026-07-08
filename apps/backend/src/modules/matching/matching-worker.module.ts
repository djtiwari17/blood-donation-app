import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MatchingService } from './matching.service';
import { MatchingProcessor } from './matching.processor';
import { MatchingScheduler } from './matching.scheduler';

/**
 * Worker-side module: the single place MATCH_REQUESTS jobs get consumed and
 * the expiry/timeout crons run. See matching.module.ts (the API-side
 * counterpart) for why this is split out — running the processor/scheduler
 * in both processes was doubling background Redis overhead for no benefit.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'MATCH_REQUESTS' }),
  ],
  providers: [MatchingService, MatchingProcessor, MatchingScheduler],
  exports: [MatchingService],
})
export class MatchingWorkerModule {}
