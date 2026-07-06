import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    RedisService,
    { provide: 'REDIS', useExisting: RedisService },
  ],
  exports: [RedisService, 'REDIS'],
})
export class RedisModule {}
