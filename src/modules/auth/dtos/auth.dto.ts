import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsPasswordPolicy } from 'src/core/validators/password-policy.decorator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsPasswordPolicy()
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsPasswordPolicy()
  newPassword: string;
}

export class ValidatePasswordResetTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ConfirmEmailVerificationDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class CompleteSsoExchangeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
