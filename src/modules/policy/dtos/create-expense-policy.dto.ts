import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ExpensePolicyRuleType,
  ExpensePolicySeverity,
} from 'src/database/entities/expense-policy.enums';

export class CreateExpensePolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  name: string;

  @IsEnum(ExpensePolicyRuleType)
  ruleType: ExpensePolicyRuleType;

  @IsEnum(ExpensePolicySeverity)
  severity: ExpensePolicySeverity;

  @IsObject()
  config: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
