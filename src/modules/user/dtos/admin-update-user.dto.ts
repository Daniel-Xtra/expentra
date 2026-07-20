import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateIf } from 'class-validator';
import { parseBooleanInput } from 'src/core/utils/helper';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEntityReference()
  roleReference?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEntityReference()
  departmentReference?: string | null;

  @IsOptional()
  @Transform(({ value }) => parseBooleanInput(value))
  @IsBoolean()
  isActive?: boolean;
}
