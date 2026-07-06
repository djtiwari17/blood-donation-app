import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  // Bind to localhost only — this port is never proxied by Nginx.
  // The HTTP server exists only so NestJS can initialise the WebSocketGateway
  // (which uses the Redis adapter to fan-out events to the API process).
  await app.listen(3001, '127.0.0.1');

  new Logger('Worker').log('BullMQ worker running on 127.0.0.1:3001');
}

bootstrap();
