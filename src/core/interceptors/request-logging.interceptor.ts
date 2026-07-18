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

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.configService.get<boolean>('LOG_HTTP_REQUESTS', true)) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (this.isHealthPath(request.url)) {
      return next.handle();
    }

    const started = Date.now();
    const { method, url } = request;
    const userId = (
      request as Request & { user?: { uniqueIdentifier?: string } }
    ).user?.uniqueIdentifier;

    return next.handle().pipe(
      tap({
        next: () =>
          this.logRequest(method, url, response.statusCode, started, userId),
        error: () =>
          this.logRequest(
            method,
            url,
            response.statusCode || 500,
            started,
            userId,
          ),
      }),
    );
  }

  private logRequest(
    method: string,
    url: string,
    statusCode: number,
    started: number,
    userUniqueIdentifier?: string,
  ): void {
    const payload = {
      method,
      url,
      statusCode,
      durationMs: Date.now() - started,
      ...(userUniqueIdentifier ? { userUniqueIdentifier } : {}),
    };
    this.logger.log(JSON.stringify(payload));
  }

  private isHealthPath(url: string): boolean {
    return url.includes('/health/live') || url.includes('/health/ready');
  }
}
