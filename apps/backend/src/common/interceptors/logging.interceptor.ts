import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

const SENSITIVE_FIELDS = ['password', 'otp', 'token', 'phone', 'fcmToken'];

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE_FIELDS.some((f) => k.toLowerCase().includes(f)) ? [k, '***'] : [k, v],
    ),
  );
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url, body, ip } = req;
    const start = Date.now();
    const safeBody = body && typeof body === 'object' ? redact(body as Record<string, unknown>) : {};

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const status = context.switchToHttp().getResponse<{ statusCode: number }>().statusCode;
        this.logger.log(`${method} ${url} ${status} ${ms}ms ip=${ip} body=${JSON.stringify(safeBody)}`);
      }),
    );
  }
}
