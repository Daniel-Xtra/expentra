import { IsEnum, IsOptional } from 'class-validator';
import { ExpenseCategory } from 'src/database/entities/expense.enums';

export class ExpensePolicyHintsQueryDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;
}
