import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class BudgetSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;
}
