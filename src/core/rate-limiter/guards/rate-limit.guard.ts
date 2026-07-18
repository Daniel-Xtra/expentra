import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { IAuthUser } from 'src/definition';
import { ApiErrorCode } from 'src/core/exceptions/api-error.types';
import { RateLimiterService } from '../rate-limiter.service';
import {
  RATE_LIMIT_METADATA_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

type RateLimitRequest = Request & {
  user?: IAuthUser;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiterService: RateLimiterService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RateLimitRequest>();

    if (this.isHealthPath(request.path ?? request.url)) {
      return true;
    }

    const response = context.switchToHttp().getResponse<Response>();

    const globalLimit = this.configService.get<number>(
      'RATE_LIMIT_GLOBAL_LIMIT',
      300,
    );
    const globalTtlSeconds = this.configService.get<number>(
      'RATE_LIMIT_GLOBAL_TTL',
      60,
    );
    const globalClientId = `ip:${this.getClientIp(request)}`;

    await this.enforceLimit(
      response,
      'global',
      globalClientId,
      globalLimit,
      globalTtlSeconds * 1000,
      false,
    );

    const endpointOptions = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_METADATA_KEY,
      context.getHandler(),
    );

    if (!endpointOptions) {
      return true;
    }

    const clientId = this.getClientIdentifier(request);
    const limit = endpointOptions.limit;
    const ttl = endpointOptions.ttl * 1000;
    const resource =
      endpointOptions.resource ??
      `${context.getClass().name}.${context.getHandler().name}`;
    const failClosed =
      endpointOptions.failClosed ?? resource.startsWith('auth.');

    await this.enforceLimit(
      response,
      resource,
      clientId,
      limit,
      ttl,
      failClosed,
    );

    return true;
  }

  private async enforceLimit(
    response: Response,
    resource: string,
    clientId: string,
    limit: number,
    ttlInMs: number,
    failClosed: boolean,
  ): Promise<void> {
    const result = await this.rateLimiterService.checkRateLimit(
      resource,
      clientId,
      limit,
      ttlInMs,
      failClosed,
    );

    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((result.resetTime - Date.now()) / 1000),
      );
      response.setHeader('Retry-After', retryAfter);

      this.logger.verbose(`Rate limit exceeded for ${clientId} on ${resource}`);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: ApiErrorCode.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getClientIdentifier(request: RateLimitRequest): string {
    if (request.user?.id) {
      return `user:${request.user.id}`;
    }

    const apiKey = request.headers['x-api-key'];
    if (typeof apiKey === 'string') {
      return `apikey:${apiKey}`;
    }

    return `ip:${this.getClientIp(request)}`;
  }

  private getClientIp(request: RateLimitRequest): string {
    const trustProxy = this.configService.get<boolean>('TRUST_PROXY', false);

    if (trustProxy) {
      const forwardedFor = request.headers['x-forwarded-for'];
      if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0].trim();
      }

      const realIp = request.headers['x-real-ip'];
      if (typeof realIp === 'string') {
        return realIp;
      }
    }

    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  private isHealthPath(path: string): boolean {
    return path.includes('/health');
  }
}
