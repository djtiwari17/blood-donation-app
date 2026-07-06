import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  db: 'ok' | 'error';
  redis: 'ok' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [dbOk, redisOk] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const status = dbOk && redisOk ? 'ok' : !dbOk && !redisOk ? 'error' : 'degraded';

    return {
      status,
      db: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor(process.uptime()),
    };
  }
}
