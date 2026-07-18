import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyFieldParamDefinitionDto } from './policy-field-param-definition.dto';

export class CreatePolicyConditionFieldDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  key: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  label: string;

  @IsString()
  @MinLength(2)
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operators?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyFieldParamDefinitionDto)
  paramDefinitions?: PolicyFieldParamDefinitionDto[];
}
