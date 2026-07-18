import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PolicyFieldParamDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  label: string;

  @IsIn(['category', 'number'])
  type: 'category' | 'number';

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
