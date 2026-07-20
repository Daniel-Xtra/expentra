import type { UserResponse } from '../../user/types/user-response.types';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

export type LoginResult = TokenPair & {
  user: UserResponse;
};

export type RegisterResult = TokenPair & {
  user: {
    email: string;
    isEmailVerified: boolean;
  };
};

export interface JwtPayload {
  reference: string;
  role: string;
  email: string;
}

export interface ConfirmPasswordResetInput {
  token: string;
  newPassword: string;
}
