import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { parseOptionalBooleanQuery } from 'src/core/utils/helper';

export enum ExpenseListSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  AMOUNT = 'amount',
  STATUS = 'status',
  SUBMITTED_AT = 'submittedAt',
  APPROVED_AT = 'approvedAt',
}

export enum ExpenseListSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListExpensesQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  actionableOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  needsAction?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  agingOnly?: boolean;

  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @IsOptional()
  @IsEnum(ExpenseListSortField)
  sortBy?: ExpenseListSortField;

  @IsOptional()
  @IsEnum(ExpenseListSortOrder)
  sortOrder?: ExpenseListSortOrder;

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
}
