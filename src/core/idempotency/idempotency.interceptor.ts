import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import type { Request, Response } from 'express';

import { Observable, from, lastValueFrom } from 'rxjs';

import type { IAuthUser } from 'src/definition';

import { IDEMPOTENCY_HEADER } from './idempotency.constants';

import { IDEMPOTENT_METADATA_KEY } from './idempotency.decorator';

import { buildIdempotencyStorageKey } from './idempotency-hash.util';

import { IdempotencyService } from './idempotency.service';

type RequestWithAuth = Request & { user?: IAuthUser };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,

    private readonly idempotencyService: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_METADATA_KEY,

      [context.getHandler(), context.getClass()],
    );

    if (!enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    const response = context.switchToHttp().getResponse<Response>();

    const user = request.user;

    if (!user?.id) {
      return next.handle();
    }

    const idempotencyKey = this.readIdempotencyKey(request);

    const storageKey = buildIdempotencyStorageKey(idempotencyKey, request.body);

    const routeKey = `${request.method}:${request.route?.path ?? request.path}`;

    return from(
      (async () => {
        const existing = await this.idempotencyService.get(
          user.id,

          routeKey,

          storageKey,
        );

        if (existing) {
          response.status(existing.statusCode);

          return existing.body;
        }

        const lockAcquired = await this.idempotencyService.acquireLock(
          user.id,

          routeKey,

          storageKey,
        );

        if (!lockAcquired) {
          const completed = await this.idempotencyService.waitForRecord(
            user.id,

            routeKey,

            storageKey,
          );

          if (completed) {
            response.status(completed.statusCode);

            return completed.body;
          }

          throw new ConflictException(
            'A request with this idempotency key is already in progress',
          );
        }

        try {
          const body = await lastValueFrom(next.handle());

          const statusCode = response.statusCode || 200;

          await this.idempotencyService.save(user.id, routeKey, storageKey, {
            statusCode,

            body,
          });

          return body;
        } finally {
          await this.idempotencyService.releaseLock(
            user.id,

            routeKey,

            storageKey,
          );
        }
      })(),
    );
  }

  private readIdempotencyKey(request: RequestWithAuth): string {
    const headerValue = request.headers[IDEMPOTENCY_HEADER];

    const key =
      typeof headerValue === 'string'
        ? headerValue.trim()
        : Array.isArray(headerValue)
          ? headerValue[0]?.trim()
          : '';

    if (!key || key.length < 8 || key.length > 128) {
      throw new BadRequestException(
        `A valid ${IDEMPOTENCY_HEADER} header (8-128 characters) is required`,
      );
    }

    return key;
  }
}
