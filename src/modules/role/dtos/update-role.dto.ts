import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  normalizeRoleName,
  ROLE_NAME_PATTERN,
  ROLE_NAME_VALIDATION_MESSAGE,
} from '../helpers/role-name.util';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(ROLE_NAME_PATTERN, { message: ROLE_NAME_VALIDATION_MESSAGE })
  @Transform(({ value }: TransformFnParams): string | undefined => {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = normalizeRoleName(value);
    return normalized || undefined;
  })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  description?: string;
}
