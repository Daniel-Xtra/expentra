import { Type } from 'class-transformer';
import { IsDate, IsString } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  delegateReference: string;

  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @Type(() => Date)
  @IsDate()
  endsAt: Date;
}
