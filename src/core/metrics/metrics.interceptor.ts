import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (this.shouldSkip(request.url)) {
      return next.handle();
    }

    const started = process.hrtime.bigint();
    const method = request.method;
    const route = this.resolveRoute(request);

    return next.handle().pipe(
      tap({
        next: () =>
          this.record(method, route, response.statusCode || 200, started),
        error: () =>
          this.record(method, route, response.statusCode || 500, started),
      }),
    );
  }

  private record(
    method: string,
    route: string,
    statusCode: number,
    started: bigint,
  ): void {
    const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    this.metricsService.observeHttpRequest({
      method,
      route,
      statusCode,
      durationSeconds,
    });
  }

  private resolveRoute(request: Request): string {
    const routePath = request.route?.path;
    if (typeof routePath === 'string' && routePath.length > 0) {
      const base = request.baseUrl || '';
      return `${base}${routePath}`;
    }
    return this.normalizePath(request.path || request.url || 'unknown');
  }

  private normalizePath(path: string): string {
    const withoutQuery = path.split('?')[0] ?? path;
    return withoutQuery
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+/g, '/:id');
  }

  private shouldSkip(url: string): boolean {
    return (
      url.includes('/health/live') ||
      url.includes('/health/ready') ||
      url.includes('/metrics')
    );
  }
}
