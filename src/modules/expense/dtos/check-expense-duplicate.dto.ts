import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ExpenseCategory } from 'src/database/entities/expense.enums';

export class CheckExpenseDuplicateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999_999_999_999)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsOptional()
  @IsString()
  excludeReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  windowDays?: number;
}
