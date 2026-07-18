import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';
import { parseOptionalBooleanQuery } from 'src/core/utils/helper';

export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEntityReference()
  departmentReference?: string;

  @IsOptional()
  @IsEntityReference()
  roleReference?: string;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  unassignedDepartment?: boolean;
}
