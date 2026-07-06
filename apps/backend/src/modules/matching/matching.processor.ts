import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MatchingService } from './matching.service';

export interface MatchRequestJob {
  requestId: string;
  radiusKm: number;
}

@Processor('MATCH_REQUESTS')
export class MatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(private readonly matchingService: MatchingService) {
    super();
  }

  async process(job: Job<MatchRequestJob>): Promise<void> {
    const { requestId, radiusKm } = job.data;
    this.logger.log(`Processing job ${job.id}: requestId=${requestId} radius=${radiusKm}km`);

    try {
      await this.matchingService.runMatching(requestId, radiusKm);
    } catch (err) {
      this.logger.error(`Job ${job.id} failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
