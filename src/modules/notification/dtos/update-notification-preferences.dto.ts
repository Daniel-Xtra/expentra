import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsObject()
  typePreferences?: Record<string, { email?: boolean; inApp?: boolean }>;
}
