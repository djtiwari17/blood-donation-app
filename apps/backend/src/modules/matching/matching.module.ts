import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';

/**
 * API-side module: enqueues MATCH_REQUESTS jobs and serves HTTP endpoints.
 * Does NOT include MatchingProcessor or MatchingScheduler — those run only
 * in the worker process (see matching-worker.module.ts). Running the BullMQ
 * job consumer and cron jobs in both the API and worker processes doubled
 * background Redis overhead (stalled-job checks, lock renewals) for zero
 * benefit, and was a major contributor to exhausting the Upstash free-tier
 * request quota within ~39 hours of idle uptime with no real traffic.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'MATCH_REQUESTS' }),
  ],
  providers: [MatchingService],
  controllers: [MatchingController],
  exports: [MatchingService],
})
export class MatchingModule {}
