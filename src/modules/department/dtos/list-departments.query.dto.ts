import { Transform, Type } from 'class-transformer';
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
import { parseOptionalBooleanQuery } from 'src/core/utils/helper';
import type {
  DepartmentHealthFilter,
  DepartmentListSortField,
  DepartmentListSortOrder,
} from '../types/department.types';

export class ListDepartmentsQueryDto {
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
  @Transform(({ obj, key }) =>
    parseOptionalBooleanQuery(obj[key as keyof typeof obj]),
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ obj, key }) =>
    parseOptionalBooleanQuery(obj[key as keyof typeof obj]),
  )
  @IsBoolean()
  missingManager?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsEnum([
    'name',
    'createdAt',
    'headcount',
    'utilizationPercent',
    'pendingApprovals',
  ])
  sortBy?: DepartmentListSortField;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: DepartmentListSortOrder;

  @IsOptional()
  @IsEnum(['over_budget', 'near_limit', 'within_limit'])
  healthFilter?: DepartmentHealthFilter;
}
