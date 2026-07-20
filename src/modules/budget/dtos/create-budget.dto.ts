import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';

export class CreateBudgetDto {
  @IsNotEmpty()
  @IsString()
  @IsEntityReference()
  departmentReference: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountLimit: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
