import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
  Req,
  Res,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  CompleteSsoExchangeDto,
  ConfirmEmailVerificationDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RegisterDto,
  RequestPasswordResetDto,
  ValidatePasswordResetTokenDto,
} from '../dtos/auth.dto';
import type { IAuthUser } from 'src/definition';
import { IResponse, successRequestResponse } from 'src/core/utils/helper';
import { RateLimit } from 'src/core/rate-limiter/decorators/rate-limit.decorator';
import { Public } from 'src/core/decorators/public.decorator';
import { AllowAuthenticated } from 'src/core/decorators/allow-authenticated.decorator';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { SkipEmailVerification } from 'src/core/decorators/skip-email-verification.decorator';
import type {
  LoginResult,
  RegisterResult,
  TokenPair,
} from '../types/auth.types';
import { AUTH_SERVICE, type IAuthService } from '../contracts/auth.contract';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
    private readonly configService: ConfigService,
  ) {}

  private refreshTokenFromCookies(req: Request): string | undefined {
    const jar: unknown = Reflect.get(req as object, 'cookies');
    if (jar == null || typeof jar !== 'object') return undefined;
    const value: unknown = Reflect.get(jar, 'refreshToken');
    return typeof value === 'string' ? value : undefined;
  }

  private refreshTokenFromPair(tokens: TokenPair): string | undefined {
    const refreshToken = tokens.refreshToken;
    return typeof refreshToken === 'string' ? refreshToken : undefined;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private setRefreshTokenCookie(res: Response, refreshToken?: string) {
    if (!refreshToken) return;

    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES',
      '7d',
    );
    let maxAge = 7 * 24 * 60 * 60 * 1000;

    if (expiresIn.endsWith('d')) {
      maxAge = parseInt(expiresIn, 10) * 24 * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('h')) {
      maxAge = parseInt(expiresIn, 10) * 60 * 60 * 1000;
    }

    res.cookie('refreshToken', refreshToken, {
      ...this.cookieOptions(),
      maxAge,
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refreshToken', this.cookieOptions());
  }

  private appUrl(): string {
    return (
      this.configService.get<string>('APP_URL')?.replace(/\/$/, '') ??
      'http://localhost:5173'
    );
  }

  private redirectSsoError(res: Response, message: string) {
    const isSuspended = message.toLowerCase().includes('suspended');
    const url = new URL(
      isSuspended ? '/account-suspended' : '/login',
      this.appUrl(),
    );
    if (!isSuspended) {
      url.searchParams.set('ssoError', message);
    }
    // Avoid leaving a half-issued session if a cookie was already set.
    this.clearRefreshTokenCookie(res);
    return res.redirect(url.toString());
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string' && response.trim()) {
        return response;
      }
      if (response && typeof response === 'object') {
        const message = Reflect.get(response, 'message');
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
        if (Array.isArray(message) && message.length > 0) {
          return String(message[0]);
        }
      }
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  }

  @Public()
  @Get('sso/status')
  @HttpCode(HttpStatus.OK)
  getSsoStatus(): IResponse {
    return successRequestResponse('SSO status', this.authService.getSsoStatus());
  }

  @Public()
  @RateLimit({ limit: 20, ttl: 60, resource: 'auth.sso.start', failClosed: true })
  @Get('sso/start')
  async startSso(@Res() res: Response): Promise<void> {
    try {
      const authorizeUrl = await this.authService.beginSsoLogin();
      res.redirect(authorizeUrl);
    } catch (error) {
      this.redirectSsoError(
        res,
        this.resolveErrorMessage(error, 'SSO is unavailable'),
      );
    }
  }

  @Public()
  @RateLimit({
    limit: 20,
    ttl: 60,
    resource: 'auth.sso.callback',
    failClosed: true,
  })
  @Get('sso/callback')
  async ssoCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.authService.completeSsoCallback({
        code,
        state,
        error,
        errorDescription,
      });
      // Do not set the refresh cookie here. Hosts share cookies by hostname
      // (not port), so a cookie from the API callback can race with SPA
      // exchange + premature refresh and leave a revoked refresh token.
      // The refresh cookie is set only on POST /auth/sso/exchange.
      const url = new URL('/auth/sso/callback', this.appUrl());
      url.searchParams.set('code', result.exchangeCode);
      res.redirect(url.toString());
    } catch (err) {
      this.redirectSsoError(
        res,
        this.resolveErrorMessage(err, 'SSO sign-in failed'),
      );
    }
  }

  @Public()
  @RateLimit({
    limit: 10,
    ttl: 60,
    resource: 'auth.sso.exchange',
    failClosed: true,
  })
  @HttpCode(HttpStatus.OK)
  @Post('sso/exchange')
  async exchangeSso(
    @Body() payload: CompleteSsoExchangeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IResponse> {
    const session: LoginResult = await this.authService.exchangeSsoCode(
      payload.code,
    );
    this.setRefreshTokenCookie(res, this.refreshTokenFromPair(session));
    return successRequestResponse('SSO login successful', {
      accessToken: session.accessToken,
      user: session.user,
    });
  }

  @Public()
  @RateLimit({ limit: 5, ttl: 60, resource: 'auth.sign-up', failClosed: true })
  @Post('sign-up')
  async signUp(
    @Body() payload: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IResponse> {
    const result: RegisterResult = await this.authService.register(payload);
    this.setRefreshTokenCookie(res, this.refreshTokenFromPair(result));
    return successRequestResponse(
      'Registration successful. Please check your email to verify your account.',
      {
        accessToken: result.accessToken,
        user: result.user,
      },
    );
  }

  @Public()
  @RateLimit({
    limit: 5,
    ttl: 60,
    resource: 'auth.email-verifications.confirm',
    failClosed: true,
  })
  @HttpCode(HttpStatus.OK)
  @Post('email-verifications/confirm')
  async confirmEmailVerification(
    @Body() payload: ConfirmEmailVerificationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IResponse> {
    const tokens = await this.authService.confirmEmailVerification(
      payload.token,
    );
    this.setRefreshTokenCookie(res, this.refreshTokenFromPair(tokens));
    return successRequestResponse('Email verified successfully', {
      accessToken: tokens.accessToken,
    });
  }

  @RateLimit({
    limit: 3,
    ttl: 60,
    resource: 'auth.email-verifications.resend',
    failClosed: true,
  })
  @AllowAuthenticated()
  @SkipEmailVerification()
  @HttpCode(HttpStatus.OK)
  @Post('email-verifications/resend')
  async resendEmailVerification(
    @AuthUser() authUser: IAuthUser,
  ): Promise<IResponse> {
    await this.authService.resendEmailVerification(authUser.email);
    return successRequestResponse(
      'If an account exists with that email and is not yet verified, a verification email has been sent.',
    );
  }

  @Public()
  @RateLimit({ limit: 5, ttl: 60, resource: 'auth.sign-in', failClosed: true })
  @HttpCode(HttpStatus.OK)
  @Post('sign-in')
  async signIn(
    @Body() payload: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IResponse> {
    const session: LoginResult = await this.authService.login(payload);
    this.setRefreshTokenCookie(res, this.refreshTokenFromPair(session));
    return successRequestResponse('Login successful', {
      accessToken: session.accessToken,
      user: session.user,
    });
  }

  @Public()
  @RateLimit({
    limit: 10,
    ttl: 60,
    resource: 'auth.tokens.refresh',
    failClosed: true,
  })
  @HttpCode(HttpStatus.OK)
  @Post('tokens/refresh')
  async refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IResponse> {
    const oldRefreshToken = this.refreshTokenFromCookies(req);
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokens = await this.authService.refresh(oldRefreshToken);
    this.setRefreshTokenCookie(res, this.refreshTokenFromPair(tokens));
    return successRequestResponse('Token refreshed', {
      accessToken: tokens.accessToken,
    });
  }

  @Public()
  @RateLimit({
    limit: 3,
    ttl: 60,
    resource: 'auth.password-resets',
    failClosed: true,
  })
  @HttpCode(HttpStatus.OK)
  @Post('password-resets')
  async createPasswordReset(
    @Body() payload: RequestPasswordResetDto,
  ): Promise<IResponse> {
    await this.authService.requestPasswordReset(payload.email);
    return successRequestResponse('Password reset email has been sent.');
  }

  @Public()
  @RateLimit({
    limit: 10,
    ttl: 60,
    resource: 'auth.password-resets.validate',
    failClosed: true,
  })
  @HttpCode(HttpStatus.OK)
  @Post('password-resets/validate')
  async validatePasswordReset(
    @Body() payload: ValidatePasswordResetTokenDto,
  ): Promise<IResponse> {
    await this.authService.validatePasswordResetToken(payload.token);
    return successRequestResponse('Password reset token validated');
  }

  @Public()
  @RateLimit({
    limit: 5,
    ttl: 60,
    resource: 'auth.password-resets.confirm',
    failClosed: true,
  })
  @HttpCode(HttpStatus.OK)
  @Post('password-resets/confirm')
  async confirmPasswordReset(
    @Body() payload: ConfirmPasswordResetDto,
  ): Promise<IResponse> {
    await this.authService.confirmPasswordReset({
      token: payload.token,
      newPassword: payload.newPassword,
    });
    return successRequestResponse('Password reset successful');
  }

  @RateLimit({
    limit: 20,
    ttl: 60,
    resource: 'auth.sign-out',
    failClosed: true,
  })
  @AllowAuthenticated()
  @SkipEmailVerification()
  @HttpCode(HttpStatus.OK)
  @Post('sign-out')
  async signOut(
    @AuthUser() user: IAuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IResponse> {
    const refreshToken = this.refreshTokenFromCookies(req);
    if (refreshToken) {
      await this.authService.logout(user, refreshToken);
    }
    this.clearRefreshTokenCookie(res);
    return successRequestResponse('Logout successful');
  }
}
