import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { IAuthUser } from 'src/definition';

export type AuthenticatedRequest = Request & {
  user: IAuthUser;
};

export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IAuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return user;
  },
);
