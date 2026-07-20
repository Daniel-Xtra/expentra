import { IsNotEmpty, IsString } from 'class-validator';
import { IsPasswordPolicy } from 'src/core/validators/password-policy.decorator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsPasswordPolicy()
  newPassword: string;
}
