import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PolicyTemplateConditionDto,
  PolicyTemplateConditionsProperty,
  TransformTemplateConditions,
} from './policy-template-condition.dto';

export class CreatePolicyRuleTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  name: string;

  @IsString()
  @MinLength(2)
  description: string;

  @IsIn(['all', 'any'])
  match: 'all' | 'any';

  @TransformTemplateConditions()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @PolicyTemplateConditionsProperty()
  conditions: PolicyTemplateConditionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
