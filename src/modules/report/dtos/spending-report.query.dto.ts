import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';
import { ExpenseCategory } from 'src/database/entities/expense.enums';
import { ReportPeriodMode } from '../constants/report-period-mode.enum';
import { ReportSpendMode } from '../constants/report-spend-mode.enum';

export class SpendingReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsEnum(ReportPeriodMode)
  periodMode?: ReportPeriodMode;

  @ValidateIf(
    (query: SpendingReportQueryDto) =>
      (query.periodMode ?? ReportPeriodMode.MONTH) === ReportPeriodMode.MONTH,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ValidateIf(
    (query: SpendingReportQueryDto) =>
      query.periodMode === ReportPeriodMode.QUARTER,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;

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
