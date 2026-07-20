import {
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthContextCacheService } from 'src/core/auth/auth-context-cache.service';
import { toAuthUser } from 'src/modules/authorization';
import type { IAuthUser } from 'src/definition';
import {
  USER_SERVICE,
  type IUserService,
} from '../../user/contracts/user.contract';
import type { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    private readonly authContextCache: AuthContextCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<IAuthUser> {
    if (!payload.reference) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const cached = await this.authContextCache.get(payload.reference);
    if (cached) {
      this.assertActiveAuthUser(cached);
      return cached;
    }

    const user = await this.userService.findAuthContext(payload.reference);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive || user.deactivatedAt) {
      throw new ForbiddenException(
        'Account has been suspended, please contact support.',
      );
    }

    const roleName = user.role?.name;
    if (!roleName) {
      throw new ForbiddenException('User has no role assigned');
    }

    const managedDepartmentIds =
      await this.userService.findManagedDepartmentIds(user.id);

    const authUser = toAuthUser(user, { managedDepartmentIds });
    await this.authContextCache.set(payload.reference, authUser);
    return authUser;
  }

  private assertActiveAuthUser(authUser: IAuthUser): void {
    if (!authUser.isActive || authUser.deactivatedAt) {
      throw new ForbiddenException(
        'Account has been suspended, please contact support.',
      );
    }

    if (!authUser.role) {
      throw new ForbiddenException('User has no role assigned');
    }
  }
}
