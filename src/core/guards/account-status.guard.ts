import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from 'src/core/decorators/public.decorator';
import { SKIP_EMAIL_VERIFICATION_KEY } from 'src/core/decorators/skip-email-verification.decorator';
import type { IAuthUser } from 'src/definition';

type RequestWithAuth = Request & { user?: IAuthUser };

@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const skipEmailVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!skipEmailVerification && !user.isEmailVerified) {
      throw new ForbiddenException('Email must be verified');
    }

    if (!user.isActive || user.deactivatedAt) {
      throw new ForbiddenException(
        'Account has been suspended, please contact support.',
      );
    }

    return true;
  }
}
