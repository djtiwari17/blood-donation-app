import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaService and RedisService are provided globally by DatabaseModule and RedisModule
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
