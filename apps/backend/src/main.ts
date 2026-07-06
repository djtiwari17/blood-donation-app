import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Sentry is optional — only active when SENTRY_DSN is set in env
async function initSentry(dsn: string | undefined) {
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({ dsn, tracesSampleRate: 0.2, environment: process.env.NODE_ENV });
    new Logger('Sentry').log('Error tracking initialized');
  } catch {
    new Logger('Sentry').warn('@sentry/node not installed — skipping (run: npm i @sentry/node)');
  }
}

async function bootstrap() {
  await initSentry(process.env.SENTRY_DSN);

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const corsOrigin = configService.get<string>('app.corsOrigin') ?? '*';
  const env = configService.get<string>('app.env') ?? 'development';
  const logger = new Logger('Bootstrap');

  // Trust the first hop (Nginx) so per-IP rate limits and IP logging
  // read the real client IP from X-Forwarded-For, not 127.0.0.1.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
  });

  // Global validation pipe — rejects requests with invalid DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strips unknown properties
      forbidNonWhitelisted: true,
      transform: true,          // auto-cast primitives
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filter + interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(), new LoggingInterceptor());

  // API versioning prefix
  app.setGlobalPrefix('v1', { exclude: ['health'] });

  await app.listen(port);
  logger.log(`Blood Donation API running on port ${port} [${env}]`);
  logger.log(`Health check: http://localhost:${port}/health`);
}

bootstrap();
