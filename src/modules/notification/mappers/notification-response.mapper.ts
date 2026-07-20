import type { Notification } from 'src/database/entities/notification.entity';

export type NotificationResponse = {
  reference: string;
  type: string;
  channel: string;
  status: string;
  payload: Record<string, unknown>;
  readAt?: Date | null;
  sentAt?: Date;
  createdAt: Date;
};

export function toNotificationResponse(
  notification: Notification,
): NotificationResponse {
  return {
    reference: notification.reference,
    type: notification.type,
    channel: notification.channel,
    status: notification.status,
    payload: notification.payload,
    readAt: notification.readAt ?? null,
    sentAt: notification.sentAt,
    createdAt: notification.createdAt,
  };
}
