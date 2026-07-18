import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_AUTHENTICATED_KEY } from 'src/core/decorators/allow-authenticated.decorator';
import { IS_PUBLIC_KEY } from 'src/core/decorators/public.decorator';
import type { IAuthUser } from 'src/definition';
import { ApiErrorCode, type ApiErrorCodeValue } from 'src/core/exceptions/api-error.types';
import { AbilityFactory } from '../ability/ability.factory';
import type { AppAbility } from '../ability/app-ability';
import {
  POLICIES_KEY,
  type PolicyHandler,
} from '../decorators/check-policies.decorator';

type RequestWithAuth = Request & { user?: IAuthUser; ability?: AppAbility };

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;

    if (!user?.role) {
      this.logDenied(request, user?.id, ApiErrorCode.FORBIDDEN, 'unauthenticated');
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'User not authenticated',
      });
    }

    request.ability = this.abilityFactory.createForUser(user);

    const policyHandlers = this.reflector.getAllAndOverride<PolicyHandler[]>(
      POLICIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!policyHandlers?.length) {
      const allowAuthenticated = this.reflector.getAllAndOverride<boolean>(
        ALLOW_AUTHENTICATED_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (allowAuthenticated) {
        return true;
      }

      this.logDenied(
        request,
        user.id,
        ApiErrorCode.POLICY_REQUIRED,
        'policy_required',
      );
      throw new ForbiddenException({
        code: ApiErrorCode.POLICY_REQUIRED,
        message:
          'This endpoint requires an explicit authorization policy. Contact an administrator if you believe this is an error.',
      });
    }

    const allowed = policyHandlers.every((handler) =>
      handler(request.ability!),
    );
    if (!allowed) {
      this.logDenied(request, user.id, ApiErrorCode.FORBIDDEN, 'policy_denied');
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'You do not have permission to perform this action',
      });
    }

    return true;
  }

  private logDenied(
    request: RequestWithAuth,
    userId: number | undefined,
    code: ApiErrorCodeValue,
    reason: string,
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'authz_denied',
        code,
        reason,
        userId: userId ?? null,
        method: request.method,
        path: request.originalUrl ?? request.url,
      }),
    );
  }
}
