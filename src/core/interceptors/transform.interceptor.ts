import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';
import { hasPayload, type IResponse } from '../utils/helper';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  IResponse<T> | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<IResponse<T> | StreamableFile> {
    const httpResponse = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((body) => {
        if (body instanceof StreamableFile) {
          return body;
        }

        const statusCode = httpResponse.statusCode || 200;

        if (body === undefined || body === null) {
          return {
            success: true,
            statusCode,
            message: this.messageForStatus(statusCode),
          } satisfies IResponse<T>;
        }

        if (this.isApiResponse(body)) {
          const { data, meta, ...rest } = body;
          return {
            ...rest,
            statusCode,
            ...(hasPayload(data) ? { data } : {}),
            ...(hasPayload(meta) ? { meta } : {}),
          } as IResponse<T>;
        }

        return {
          success: true,
          statusCode,
          message: this.messageForStatus(statusCode),
          data: body,
        } satisfies IResponse<T>;
      }),
    );
  }

  private isApiResponse(value: unknown): value is IResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.success === 'boolean' &&
      typeof candidate.statusCode === 'number' &&
      typeof candidate.message === 'string'
    );
  }

  private messageForStatus(statusCode: number): string {
    const messages: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
    };
    return messages[statusCode] ?? 'OK';
  }
}
