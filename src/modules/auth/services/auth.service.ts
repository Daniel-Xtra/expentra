import {
  Inject,
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  USER_SERVICE,
  type IUserService,
} from '../../user/contracts/user.contract';
import { RedisService } from '../../../core/redis/redis.service';
import { DataSource } from 'typeorm';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as crypto from 'crypto';
import type {
  RegisterInput,
  LoginInput,
  TokenPair,
  LoginResult,
  JwtPayload,
  RegisterResult,
  ConfirmPasswordResetInput,
} from '../types/auth.types';
import type {
  IAuthService,
  SsoCallbackResult,
  SsoStatus,
} from '../contracts/auth.contract';
import { toUserResponse } from '../../user/mappers/user-response.mapper';
import { IAuthUser } from 'src/definition';
import { User } from 'src/database/entities/user.entity';
import { OidcService } from './oidc.service';

type SsoStatePayload = {
  codeVerifier: string;
};

type SsoExchangePayload = {
  accessToken: string;
  refreshToken: string;
  userReference: string;
};

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly REFRESH_PREFIX = 'auth:refresh:';
  private readonly PASSWORD_RESET_PREFIX = 'auth:pwdreset:';
  private readonly EMAIL_VERIFY_PREFIX = 'auth:email-verify:';
  private readonly SSO_STATE_PREFIX = 'auth:sso:state:';
  private readonly SSO_EXCHANGE_PREFIX = 'auth:sso:exchange:';
  private readonly PASSWORD_RESET_TTL_SECONDS = 15 * 60;
  private readonly EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60;
  private readonly SSO_STATE_TTL_SECONDS = 10 * 60;
  private readonly SSO_EXCHANGE_TTL_SECONDS = 60;
  private readonly OTP_LENGTH = 6;
  private readonly DEV_OPAQUE_TOKEN = '123456';
  private readonly SSO_AUTH_PROVIDER = 'oidc';

  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    private readonly jwtService: NestJwtService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly oidcService: OidcService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    if (!user?.password) return null;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    if (!user.isActive || user.deactivatedAt) {
      return null;
    }

    return user;
  }

  async register(payload: RegisterInput): Promise<RegisterResult> {
    if (!this.configService.get<boolean>('ALLOW_PUBLIC_REGISTRATION', false)) {
      throw new ForbiddenException(
        'Public registration is disabled. Contact an administrator for access.',
      );
    }

    const user = await this.dataSource.transaction(async (manager) => {
      const existingUser = await manager.getRepository(User).findOne({
        where: { email: payload.email },
      });
      if (existingUser) {
        throw new BadRequestException('User already exists');
      }
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(payload.password, saltRounds);

      return this.userService.createWithHash(
        {
          email: payload.email,
          passwordHash,
          firstName: payload.firstName,
          lastName: payload.lastName,
          isActive: true,
        },
        manager,
      );
    });

    this.logger.log(`New registration: user ${user.email}`);
    const tokens = await this.issueTokens(user);
    await this.sendEmailVerification(user.id, {
      email: user.email,
      firstName: user.firstName,
    });

    return {
      ...tokens,
      user: {
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async login(payload: LoginInput): Promise<LoginResult> {
    const user = await this.userService.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses single sign-on. Use Sign in with SSO.',
      );
    }

    const isMatch = await bcrypt.compare(payload.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    if (!user.isActive || user.deactivatedAt) {
      throw new ForbiddenException(
        'Account has been suspended, please contact support.',
      );
    }

    const userWithRole = await this.userService.findOne(user.id);
    this.logger.log(`Login: user ${userWithRole.email}`);
    const tokens = await this.issueTokens(userWithRole);

    if (!userWithRole.isEmailVerified) {
      await this.sendEmailVerification(userWithRole.id, {
        email: userWithRole.email,
        firstName: userWithRole.firstName,
      });
    }

    return {
      ...tokens,
      user: toUserResponse(userWithRole),
    };
  }

  getSsoStatus(): SsoStatus {
    const enabled = this.oidcService.isEnabled();
    return {
      enabled,
      buttonLabel: enabled ? this.oidcService.getButtonLabel() : 'Sign in with SSO',
    };
  }

  async beginSsoLogin(): Promise<string> {
    this.oidcService.assertEnabled();
    const state = this.oidcService.createState();
    const { codeVerifier, codeChallenge } = this.oidcService.createPkcePair();

    await this.redisService.setCache(
      `${this.SSO_STATE_PREFIX}${state}`,
      { codeVerifier } satisfies SsoStatePayload,
      this.SSO_STATE_TTL_SECONDS,
    );

    return this.oidcService.buildAuthorizationUrl({ state, codeChallenge });
  }

  async completeSsoCallback(params: {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  }): Promise<SsoCallbackResult> {
    this.oidcService.assertEnabled();

    if (params.error) {
      const detail = params.errorDescription || params.error;
      throw new UnauthorizedException(`SSO sign-in was denied: ${detail}`);
    }

    const code = (params.code ?? '').trim();
    const state = (params.state ?? '').trim();
    if (!code || !state) {
      throw new UnauthorizedException('SSO callback is missing code or state');
    }

    const stateKey = `${this.SSO_STATE_PREFIX}${state}`;
    const stored = await this.redisService.getCache<SsoStatePayload>(stateKey);
    await this.redisService.del(stateKey);

    if (!stored?.codeVerifier) {
      throw new UnauthorizedException('SSO session expired. Try again.');
    }

    const tokenResponse = await this.oidcService.exchangeAuthorizationCode({
      code,
      codeVerifier: stored.codeVerifier,
    });

    const profile = await this.oidcService.fetchUserInfo(
      tokenResponse.access_token,
    );
    const user = await this.resolveSsoUser(profile);
    const tokens = await this.issueTokens(user);

    const exchangeCode = this.oidcService.createState();
    if (!tokens.refreshToken) {
      throw new BadRequestException('Failed to issue SSO session');
    }
    await this.redisService.setCache(
      `${this.SSO_EXCHANGE_PREFIX}${exchangeCode}`,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userReference: user.reference,
      } satisfies SsoExchangePayload,
      this.SSO_EXCHANGE_TTL_SECONDS,
    );

    this.logger.log(`SSO login: user ${user.email}`);
    return { exchangeCode, tokens };
  }

  async exchangeSsoCode(exchangeCode: string): Promise<LoginResult> {
    this.oidcService.assertEnabled();

    const code = (exchangeCode ?? '').trim();
    if (!code) {
      throw new UnauthorizedException('SSO exchange code is missing');
    }

    const exchangeKey = `${this.SSO_EXCHANGE_PREFIX}${code}`;
    const stored =
      await this.redisService.getCache<SsoExchangePayload>(exchangeKey);
    await this.redisService.del(exchangeKey);

    if (!stored?.accessToken || !stored.refreshToken || !stored.userReference) {
      throw new UnauthorizedException(
        'SSO exchange code is invalid or expired',
      );
    }

    const user = await this.userService.findOneByReference(stored.userReference);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.isActive || user.deactivatedAt) {
      throw new ForbiddenException(
        'Account has been suspended, please contact support.',
      );
    }

    // Drop any refresh token issued at IdP callback / cached for exchange so a
    // premature rotate (or stale cookie) cannot leave the browser with a
    // revoked token. Issue a fresh pair for the SPA session.
    const cachedRefreshHash = this.hashToken(stored.refreshToken);
    await this.redisService.del(
      `${this.REFRESH_PREFIX}${user.reference}:${cachedRefreshHash}`,
    );

    const tokens = await this.issueTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: toUserResponse(user),
    };
  }

  private async resolveSsoUser(profile: {
    sub: string;
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    name?: string;
    preferred_username?: string;
    picture?: string;
  }): Promise<User> {
    const externalId = (profile.sub ?? '').trim();
    if (!externalId) {
      throw new UnauthorizedException('SSO provider did not return a subject');
    }

    const email = this.extractSsoEmail(profile);
    this.assertAllowedEmailDomain(email);
    const avatarUrl = this.extractSsoAvatarUrl(profile);

    const existingByExternal = await this.userService.findByExternalIdentity(
      this.SSO_AUTH_PROVIDER,
      externalId,
    );
    if (existingByExternal) {
      if (!existingByExternal.isActive || existingByExternal.deactivatedAt) {
        throw new ForbiddenException(
          'Account has been suspended, please contact support.',
        );
      }
      await this.userService.syncSsoProfile(existingByExternal.id, { avatarUrl });
      return this.userService.findOne(existingByExternal.id);
    }

    const existingByEmail = await this.userService.findByEmail(email);
    if (existingByEmail) {
      if (!existingByEmail.isActive || existingByEmail.deactivatedAt) {
        throw new ForbiddenException(
          'Account has been suspended, please contact support.',
        );
      }

      await this.userService.linkSsoIdentity(existingByEmail.id, {
        authProvider: this.SSO_AUTH_PROVIDER,
        externalId,
        avatarUrl,
      });

      if (!existingByEmail.isEmailVerified) {
        await this.userService.markEmailVerified(existingByEmail.id);
      }

      return this.userService.findOne(existingByEmail.id);
    }

    const autoProvision = this.configService.get<boolean>(
      'SSO_AUTO_PROVISION',
      false,
    );
    if (!autoProvision) {
      throw new ForbiddenException(
        'No Expentra account exists for this email. Contact an administrator.',
      );
    }

    const { firstName, lastName } = this.extractSsoNames(profile);
    return this.userService.createSsoUser({
      email,
      authProvider: this.SSO_AUTH_PROVIDER,
      externalId,
      firstName,
      lastName,
      avatarUrl,
    });
  }

  private extractSsoEmail(profile: {
    email?: string;
    preferred_username?: string;
  }): string {
    const raw = (profile.email ?? profile.preferred_username ?? '')
      .trim()
      .toLowerCase();
    if (!raw || !raw.includes('@')) {
      throw new UnauthorizedException(
        'SSO provider did not return a verified email address',
      );
    }
    return raw;
  }

  private extractSsoAvatarUrl(profile: { picture?: string }): string | null {
    const raw = (profile.picture ?? '').trim();
    if (!raw || raw.length > 2048) {
      return null;
    }

    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  private extractSsoNames(profile: {
    given_name?: string;
    family_name?: string;
    name?: string;
  }): { firstName?: string; lastName?: string } {
    if (profile.given_name || profile.family_name) {
      return {
        firstName: profile.given_name?.trim() || undefined,
        lastName: profile.family_name?.trim() || undefined,
      };
    }

    const parts = (profile.name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return {};
    }
    return {
      firstName: parts[0],
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
    };
  }

  private assertAllowedEmailDomain(email: string): void {
    const raw = this.configService.get<string>('SSO_ALLOWED_EMAIL_DOMAINS', '');
    const domains = raw
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    if (domains.length === 0) {
      return;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !domains.includes(domain)) {
      throw new ForbiddenException(
        'Your email domain is not allowed to sign in with SSO',
      );
    }
  }

  async confirmEmailVerification(token: string): Promise<TokenPair> {
    const normalized = (token ?? '').trim();
    if (!normalized) {
      throw new UnauthorizedException('Verification token is missing');
    }

    const tokenHash = this.hashToken(normalized);
    const tokenKey = this.emailVerificationTokenKey(tokenHash);
    const stored = await this.redisService.getCache<{ id: number }>(tokenKey);

    if (!stored?.id) {
      throw new UnauthorizedException(
        'Verification token is invalid or expired',
      );
    }

    const user = await this.userService.findOne(stored.id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.clearEmailVerificationForUser(user.id);

    if (!user.isEmailVerified) {
      await this.userService.markEmailVerified(user.id);
    }

    const userWithRole = await this.userService.findOne(user.id);
    this.logger.log(`Email verified: user ${userWithRole.email}`);
    return this.issueTokens(userWithRole);
  }

  async resendEmailVerification(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user || user.isEmailVerified) {
      return;
    }

    await this.sendEmailVerification(user.id, {
      email: user.email,
      firstName: user.firstName,
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return;
    }

    const resetToken = this.createOtpCode();
    const tokenHash = this.hashToken(resetToken);

    await this.clearPasswordResetForUser(user.id);

    const tokenKey = this.passwordResetTokenKey(tokenHash);
    const userKey = this.passwordResetUserKey(user.id);
    await this.redisService.setCache(
      tokenKey,
      { id: user.id },
      this.PASSWORD_RESET_TTL_SECONDS,
    );
    await this.redisService.setCache(
      userKey,
      { tokenHash },
      this.PASSWORD_RESET_TTL_SECONDS,
    );

    await this.domainEventPublisher.publish('auth.password-reset', {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      resetToken,
    });
  }

  async confirmPasswordReset(params: ConfirmPasswordResetInput): Promise<void> {
    const token = (params.token ?? '').trim();
    if (!token) {
      throw new UnauthorizedException('Reset token is missing');
    }

    const tokenHash = this.hashToken(token);
    const tokenKey = this.passwordResetTokenKey(tokenHash);

    const stored = await this.redisService.getCache<{ id: number }>(tokenKey);
    if (!stored?.id) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }

    await this.redisService.del(tokenKey);
    await this.redisService.del(this.passwordResetUserKey(stored.id));

    const user = await this.userService.findOne(stored.id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const passwordHash = await bcrypt.hash(params.newPassword, 10);
    await this.userService.updatePasswordHash(user.id, passwordHash);

    await this.redisService.delByPattern(
      `${this.REFRESH_PREFIX}${user.reference}:*`,
    );
  }

  async validatePasswordResetToken(token: string) {
    const normalized = (token ?? '').trim();
    if (!normalized) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }

    const tokenHash = this.hashToken(normalized);
    const redisKey = `${this.PASSWORD_RESET_PREFIX}${tokenHash}`;

    const stored = await this.redisService.getCache<{ id: number }>(redisKey);
    if (!stored?.id) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const tokenHash = this.hashToken(refreshToken);
    const redisKey = `${this.REFRESH_PREFIX}${payload.reference}:${tokenHash}`;
    const graceKey = `${redisKey}:grace`;

    const stored = await this.redisService.get(redisKey);
    if (!stored) {
      // Allow a short reuse window so a refresh that completed server-side
      // (but whose response was lost on page reload) does not force re-login.
      const grace = await this.redisService.get(graceKey);
      if (!grace) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }
    } else {
      await this.redisService.del(redisKey);
      await this.redisService.setCache(graceKey, 1, 30);
    }

    const user = await this.userService.findOneByReference(payload.reference);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    this.logger.log(`Token refresh: user ${user.email}`);
    return this.issueTokens(user);
  }

  async logout(user: IAuthUser, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const redisKey = `${this.REFRESH_PREFIX}${user.reference}:${tokenHash}`;
    await this.redisService.del(redisKey);
    this.logger.log(`Logout: user ${user.email}`);
  }

  private async sendEmailVerification(
    userId: number,
    params: { email: string; firstName?: string },
  ) {
    const verifyToken = this.createOtpCode();
    const tokenHash = this.hashToken(verifyToken);

    await this.clearEmailVerificationForUser(userId);

    await this.redisService.setCache(
      this.emailVerificationTokenKey(tokenHash),
      { id: userId },
      this.EMAIL_VERIFY_TTL_SECONDS,
    );
    await this.redisService.setCache(
      this.emailVerificationUserKey(userId),
      { tokenHash },
      this.EMAIL_VERIFY_TTL_SECONDS,
    );

    await this.domainEventPublisher.publish('auth.email-verification', {
      userId,
      email: params.email,
      firstName: params.firstName,
      verifyToken,
    });

    return { verifyToken, email: params.email };
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const roleName = user.role?.name;

    const payload: JwtPayload = {
      reference: user.reference,
      role: roleName,
      email: user.email,
    };

    const jwtExpiresInRaw = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '1d',
    );
    const jwtRefreshExpiresInRaw = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES',
      '7d',
    );
    const accessExpiresIn = jwtExpiresInRaw as NonNullable<
      JwtSignOptions['expiresIn']
    >;
    const refreshExpiresIn = jwtRefreshExpiresInRaw as NonNullable<
      JwtSignOptions['expiresIn']
    >;

    let ttlSeconds = 7 * 24 * 60 * 60;
    if (jwtRefreshExpiresInRaw.endsWith('d')) {
      ttlSeconds = parseInt(jwtRefreshExpiresInRaw, 10) * 24 * 60 * 60;
    } else if (jwtRefreshExpiresInRaw.endsWith('h')) {
      ttlSeconds = parseInt(jwtRefreshExpiresInRaw, 10) * 60 * 60;
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: accessExpiresIn }),
      this.jwtService.signAsync(payload, {
        expiresIn: refreshExpiresIn,
        secret: this.refreshTokenSecret(),
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const redisKey = `${this.REFRESH_PREFIX}${user.reference}:${tokenHash}`;

    await this.redisService.setCache(redisKey, '1', ttlSeconds);

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private createOtpCode(): string {
    const allowDevToken = this.configService.get<boolean>(
      'ALLOW_DEV_OPAQUE_TOKEN',
      false,
    );
    if (allowDevToken) {
      return this.DEV_OPAQUE_TOKEN;
    }
    return String(crypto.randomInt(0, 10 ** this.OTP_LENGTH)).padStart(
      this.OTP_LENGTH,
      '0',
    );
  }

  private emailVerificationUserKey(userId: number): string {
    return `${this.EMAIL_VERIFY_PREFIX}user:${userId}`;
  }

  private emailVerificationTokenKey(tokenHash: string): string {
    return `${this.EMAIL_VERIFY_PREFIX}${tokenHash}`;
  }

  private async clearEmailVerificationForUser(userId: number): Promise<void> {
    const userKey = this.emailVerificationUserKey(userId);
    const existing = await this.redisService.getCache<{ tokenHash: string }>(
      userKey,
    );
    if (existing?.tokenHash) {
      await this.redisService.del(
        this.emailVerificationTokenKey(existing.tokenHash),
      );
    }
    await this.redisService.del(userKey);
  }

  private passwordResetTokenKey(tokenHash: string): string {
    return `${this.PASSWORD_RESET_PREFIX}${tokenHash}`;
  }

  private passwordResetUserKey(userId: number): string {
    return `${this.PASSWORD_RESET_PREFIX}user:${userId}`;
  }

  private async clearPasswordResetForUser(userId: number): Promise<void> {
    const userKey = this.passwordResetUserKey(userId);
    const existing = await this.redisService.getCache<{ tokenHash: string }>(
      userKey,
    );
    if (existing?.tokenHash) {
      await this.redisService.del(
        this.passwordResetTokenKey(existing.tokenHash),
      );
    }
    await this.redisService.del(userKey);
  }

  private tokenHashMatches(token: string, storedHash: string): boolean {
    const providedHash = this.hashToken(token);
    const provided = Buffer.from(providedHash, 'utf8');
    const stored = Buffer.from(storedHash, 'utf8');
    if (provided.length !== stored.length) {
      return false;
    }
    return crypto.timingSafeEqual(provided, stored);
  }

  private refreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET')
    );
  }
}
