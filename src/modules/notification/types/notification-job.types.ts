import type { WithJobCorrelation } from 'src/core/correlation/job-correlation.types';
import type { ExternalEmailAttachment } from '../contracts/external-notification.contract';

export type EmailNotificationJobData = WithJobCorrelation<{
  notificationReference: string;
  to: string;
  template?: string;
  data?: Record<string, unknown>;
  attachments?: ExternalEmailAttachment[];
}>;
