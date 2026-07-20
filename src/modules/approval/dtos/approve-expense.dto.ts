import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  overBudgetAcknowledged?: boolean;
}
