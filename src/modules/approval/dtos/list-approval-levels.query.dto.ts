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
} from 'class-validator';
import { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import { parseOptionalBooleanQuery } from 'src/core/utils/helper';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';

export class ListApprovalLevelsQueryDto {
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
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  search?: string;

  @IsOptional()
  @Transform(({ obj, key }) =>
    parseOptionalBooleanQuery(obj[key as keyof typeof obj]),
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ApprovalApproverType)
  approverType?: ApprovalApproverType;

  @IsOptional()
  @IsEntityReference()
  roleReference?: string;
}
