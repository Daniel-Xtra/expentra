import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';
import type {
  BudgetHealthFilter,
  BudgetListSortField,
  BudgetListSortOrder,
} from '../types/budget.types';

export class ListBudgetsQueryDto {
  @IsOptional()
  @IsEntityReference()
  departmentReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

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
  @IsEnum([
    'departmentName',
    'year',
    'amountLimit',
    'committedAmount',
    'reimbursedAmount',
    'remainingAmount',
    'utilizationPercent',
  ])
  sortBy?: BudgetListSortField;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: BudgetListSortOrder;

  @IsOptional()
  @IsEnum(['over_budget', 'near_limit', 'within_limit'])
  healthFilter?: BudgetHealthFilter;
}
