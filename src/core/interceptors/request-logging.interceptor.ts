import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import {
  CORRELATION_ID_KEY,
  type RequestWithCorrelationId,
} from '../middleware/correlation-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.configService.get<boolean>('LOG_HTTP_REQUESTS', true)) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithCorrelationId>();
    const response = http.getResponse<Response>();

    if (this.isHealthPath(request.url)) {
      return next.handle();
    }

    const started = Date.now();
    const { method, url } = request;
    const userRef = (request as Request & { user?: { reference?: string } })
      .user?.reference;
    const correlationId = request[CORRELATION_ID_KEY];

    return next.handle().pipe(
      tap({
        next: () =>
          this.logRequest(
            method,
            url,
            response.statusCode,
            started,
            correlationId,
            userRef,
          ),
        error: () =>
          this.logRequest(
            method,
            url,
            response.statusCode || 500,
            started,
            correlationId,
            userRef,
          ),
      }),
    );
  }

  private logRequest(
    method: string,
    url: string,
    statusCode: number,
    started: number,
    correlationId?: string,
    userReference?: string,
  ): void {
    const payload = {
      method,
      url,
      statusCode,
      durationMs: Date.now() - started,
      ...(correlationId ? { correlationId } : {}),
      ...(userReference ? { userReference } : {}),
    };
    this.logger.log(JSON.stringify(payload));
  }

  private isHealthPath(url: string): boolean {
    return (
      url.includes('/health/live') ||
      url.includes('/health/ready') ||
      url.includes('/metrics')
    );
  }
}
