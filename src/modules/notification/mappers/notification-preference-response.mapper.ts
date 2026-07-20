import type { NotificationPreference } from 'src/database/entities/notification-preference.entity';

export type NotificationPreferenceResponse = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  typePreferences: Record<string, { email?: boolean; inApp?: boolean }>;
  updatedAt: Date;
};

export function toNotificationPreferenceResponse(
  preference: NotificationPreference,
): NotificationPreferenceResponse {
  return {
    emailEnabled: preference.emailEnabled,
    inAppEnabled: preference.inAppEnabled,
    typePreferences: preference.typePreferences,
    updatedAt: preference.updatedAt,
  };
}
