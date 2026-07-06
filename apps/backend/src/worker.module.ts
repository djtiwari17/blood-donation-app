import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { appConfig, appConfigSchema } from './config/app.config';
import { RedisModule } from './redis/redis.module';
import { DatabaseModule } from './database/database.module';
import { MatchingModule } from './modules/matching/matching.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/**
 * Slim module for the BullMQ worker process.
 *
 * Includes only the dependencies required for:
 *   - Processing MATCH_REQUESTS queue jobs (MatchingProcessor)
 *   - Running cron jobs: expireStaleRequests, timeoutStaleMatches (MatchingScheduler)
 *   - Sending FCM + WebSocket notifications after job completion
 *
 * Does NOT include HTTP controllers, ThrottlerModule, AuthModule, or any
 * request-handling modules — the worker never accepts inbound HTTP traffic.
 * It listens on 127.0.0.1:3001 solely so the NestJS platform can initialise
 * the WebSocketGateway (which attaches to the HTTP server). Nginx does NOT
 * proxy to port 3001.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: appConfigSchema,
      validationOptions: { abortEarly: true },
    }),

    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rawUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const url = new URL(rawUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),

    RedisModule,
    DatabaseModule,
    MatchingModule,
    NotificationsModule,
  ],
})
export class WorkerModule {}
