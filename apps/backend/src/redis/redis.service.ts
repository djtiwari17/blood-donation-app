import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    super(redisUrl, {
      // Retry strategy: exponential backoff, max 30s
      retryStrategy: (times) => Math.min(times * 500, 30000),
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      // TLS is automatic for rediss:// URLs
    });

    this.on('connect', () => this.logger.log('Redis connected'));
    this.on('error', (err) => this.logger.error('Redis error', err.message));
    this.on('reconnecting', () => this.logger.warn('Redis reconnecting...'));
  }

  async onModuleDestroy() {
    await this.quit();
    this.logger.log('Redis disconnected');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
