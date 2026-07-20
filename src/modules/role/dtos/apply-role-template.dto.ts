import { IsString, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class ApplyRoleTemplateDto {
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: TransformFnParams): string =>
    typeof value === 'string' ? value.trim() : '',
  )
  templateKey: string;
}
