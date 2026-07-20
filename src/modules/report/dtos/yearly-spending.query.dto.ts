import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';
import { ExpenseCategory } from 'src/database/entities/expense.enums';
import { ReportSpendMode } from '../constants/report-spend-mode.enum';

export class YearlySpendingQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsEntityReference()
  departmentReference?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePipeline?: boolean;

  @IsOptional()
  @IsEnum(ReportSpendMode)
  mode?: ReportSpendMode;
}
