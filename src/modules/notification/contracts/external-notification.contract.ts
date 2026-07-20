export type ExternalEmailAttachment = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export type ExternalEmailPayload = {
  to: string;
  template: string;
  data: Record<string, unknown>;
  attachments?: ExternalEmailAttachment[];
};

export const EXTERNAL_NOTIFICATION_SENDER = Symbol(
  'EXTERNAL_NOTIFICATION_SENDER',
);

export interface IExternalNotificationSender {
  sendEmail(payload: ExternalEmailPayload): Promise<void>;
}
