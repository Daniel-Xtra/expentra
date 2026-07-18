import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ExpenseCategory } from 'src/database/entities/expense.enums';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Amount in minor units (e.g. ₦45.00 → 4500). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999_999_999_999)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsOptional()
  @IsDateString()
  incurredAt?: string;
}
