import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateBudgetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
