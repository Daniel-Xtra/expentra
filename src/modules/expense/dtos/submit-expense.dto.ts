import { IsObject, IsOptional } from 'class-validator';

export class SubmitExpenseDto {
  @IsOptional()
  @IsObject()
  policyJustifications?: Record<string, string>;
}
