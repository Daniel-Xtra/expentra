import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BulkRejectExpensesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  references: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  comment: string;
}
