import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { appConfig, appConfigSchema } from './config/app.config';
import { RedisModule } from './redis/redis.module';
import { DatabaseModule } from './database/database.module';
import { SmsModule } from './modules/sms/sms.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { UsersModule } from './modules/users/users.module';
import { DonorsModule } from './modules/donors/donors.module';
import { RequestsModule } from './modules/requests/requests.module';
import { MatchingModule } from './modules/matching/matching.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';
import { CampsModule } from './modules/camps/camps.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: appConfigSchema,
      validationOptions: { abortEarly: true },
    }),

    // Global rate limit: 100 req/min per IP (overridden per route where needed)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Cron/scheduler for expiring requests and timing out matches
    ScheduleModule.forRoot(),

    // BullMQ — Redis connection from config
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
    SmsModule,
    HealthModule,
    AuthModule,
    GeocodingModule,
    UsersModule,
    DonorsModule,
    RequestsModule,
    MatchingModule,
    WebSocketModule,
    NotificationsModule,
    ReportsModule,
    AdminModule,
    CampsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
