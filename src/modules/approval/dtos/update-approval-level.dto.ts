import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';

function toBooleanValue(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

export class UpdateApprovalLevelDto {
  @IsOptional()
  @IsEnum(ApprovalApproverType)
  approverType?: ApprovalApproverType;

  @ValidateIf(
    (dto: UpdateApprovalLevelDto) =>
      dto.approverType === ApprovalApproverType.FINANCE_MANAGER,
  )
  @IsOptional()
  @IsEntityReference()
  roleReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32767)
  level?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maximumAmount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toBooleanValue(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: TransformFnParams): string | null | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  description?: string | null;
}
