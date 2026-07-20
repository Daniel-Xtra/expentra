import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 20;
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).+$/;
export const PASSWORD_PATTERN_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';

export function IsPasswordPolicy(): ReturnType<typeof applyDecorators> {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: 'Password should be at least 8 characters long',
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: 'Password should not exceed 20 characters',
    }),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE }),
  );
}
