import type { IAuthUser } from 'src/definition';
import type {
  ConfirmPasswordResetInput,
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
  TokenPair,
} from '../types/auth.types';

export const AUTH_SERVICE = Symbol('AUTH_SERVICE');

export type SsoStatus = {
  enabled: boolean;
  buttonLabel: string;
};

export type SsoCallbackResult = {
  exchangeCode: string;
  tokens: TokenPair;
};

export interface IAuthService {
  register(payload: RegisterInput): Promise<RegisterResult>;
  login(payload: LoginInput): Promise<LoginResult>;
  confirmEmailVerification(token: string): Promise<TokenPair>;
  resendEmailVerification(email: string): Promise<void>;
  refresh(refreshToken: string): Promise<TokenPair>;
  requestPasswordReset(email: string): Promise<void>;
  validatePasswordResetToken(token: string): Promise<void>;
  confirmPasswordReset(params: ConfirmPasswordResetInput): Promise<void>;
  logout(user: IAuthUser, refreshToken: string): Promise<void>;
  getSsoStatus(): SsoStatus;
  beginSsoLogin(): Promise<string>;
  completeSsoCallback(params: {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  }): Promise<SsoCallbackResult>;
  exchangeSsoCode(exchangeCode: string): Promise<LoginResult>;
}
