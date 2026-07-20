import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ExternalEmailPayload,
  IExternalNotificationSender,
} from 'src/modules/notification/contracts/external-notification.contract';

const SUCCESS_RESPONSE_CODE = '00';
const REQUEST_TIMEOUT_MS = 30_000;

type NotificationConfig = {
  sendUrl: string;
  clientId: string;
};

type NotificationSendRequest = {
  clientId: string;
  templateName: string;
  parameters: unknown;
  toEmail: string;
  sendEmail: boolean;
  sendSms: boolean;
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    content: string;
  }>;
};

type NotificationApiResponse = {
  responseCode: string;
  responseMessage: string;
  data: string;
};

class NotificationHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'NotificationHttpError';
  }
}

function readNotificationConfig(
  config: ConfigService,
): NotificationConfig | null {
  const sendUrl = config.get<string>('NOTIFICATION_SERVICE_URL')?.trim();
  if (!sendUrl) {
    return null;
  }

  const clientId = config.get<string>('NOTIFICATION_CLIENT_ID')?.trim();
  if (!clientId) {
    throw new Error(
      'NOTIFICATION_CLIENT_ID is required when NOTIFICATION_SERVICE_URL is set',
    );
  }

  return { sendUrl, clientId };
}

@Injectable()
export class ExternalNotificationService implements IExternalNotificationSender {
  private readonly logger = new Logger(ExternalNotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(payload: ExternalEmailPayload): Promise<void> {
    const config = readNotificationConfig(this.configService);
    if (!config) {
      this.logger.log(
        `[dev] Notification skipped (NOTIFICATION_SERVICE_URL unset) → ${payload.to}`,
      );
      this.logger.debug({
        to: payload.to,
        template: payload.template,
        data: payload.data,
        attachmentCount: payload.attachments?.length ?? 0,
        attachmentNames: payload.attachments?.map((a) => a.fileName),
      });
      return;
    }

    const templateName = payload.template;
    const parameters: Record<string, unknown> = {
      ...(payload.data ?? {}),
    };

    await this.sendTemplated(
      templateName,
      payload.to,
      parameters,
      payload.attachments,
    );
  }

  private async sendTemplated(
    templateName: string,
    toEmail: string,
    parameters: Record<string, unknown>,
    attachments?: ExternalEmailPayload['attachments'],
  ): Promise<NotificationApiResponse> {
    const request: NotificationSendRequest = {
      clientId: this.getClientId(),
      templateName,
      parameters,
      toEmail: this.assertRecipientEmail(toEmail),
      sendEmail: true,
      sendSms: false,
      ...(attachments?.length
        ? {
            attachments: attachments.map((attachment) => ({
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              content: attachment.contentBase64,
            })),
          }
        : {}),
    };

    return this.postNotification(request);
  }

  private getClientId(): string {
    const config = readNotificationConfig(this.configService);
    if (!config) {
      throw new Error('Notification service is not configured');
    }
    return config.clientId;
  }

  private getSendUrl(): string {
    const config = readNotificationConfig(this.configService);
    if (!config) {
      throw new Error('Notification service is not configured');
    }
    return config.sendUrl;
  }

  private async postNotification(
    request: NotificationSendRequest,
  ): Promise<NotificationApiResponse> {
    this.logger.log(`Sending ${request.templateName} to ${request.toEmail}`);

    try {
      const data = await this.postJson(this.getSendUrl(), request);
      const parsed = this.parseNotificationResponse(data);
      if (parsed.responseCode !== SUCCESS_RESPONSE_CODE) {
        throw new Error(`Notification failed: ${parsed.responseMessage}`);
      }

      this.logger.log(
        `Successfully sent ${request.templateName} (code=${parsed.responseCode})`,
      );
      return parsed;
    } catch (error) {
      this.logSendFailure(request.templateName, error);
      throw error;
    }
  }

  private async postJson(url: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Notification request timed out', { cause: error });
      }
      throw error;
    }

    const responseBody = await this.readResponseBody(response);
    if (!response.ok) {
      throw new NotificationHttpError(
        `Notification HTTP ${response.status}`,
        response.status,
        responseBody,
      );
    }

    return responseBody;
  }

  private async readResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private parseNotificationResponse(data: unknown): NotificationApiResponse {
    if (!data || typeof data !== 'object') {
      throw new Error('Notification: empty or invalid response body');
    }

    const body = data as Record<string, unknown>;
    const responseCode = body.responseCode;
    const responseMessage = body.responseMessage;
    const payload = body.data;

    if (
      typeof responseCode !== 'string' ||
      typeof responseMessage !== 'string'
    ) {
      throw new Error(
        'Notification: response missing responseCode/responseMessage',
      );
    }

    return {
      responseCode,
      responseMessage,
      data:
        typeof payload === 'string' ? payload : JSON.stringify(payload ?? ''),
    };
  }

  private assertRecipientEmail(toEmail: string): string {
    const trimmed = toEmail?.trim() ?? '';
    if (!trimmed) {
      throw new Error('Notification: recipient email is required');
    }
    return trimmed;
  }

  private formatResponseData(data: unknown): string {
    if (data === undefined) {
      return 'undefined';
    }
    if (data === null) {
      return 'null';
    }
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }
    try {
      return JSON.stringify(data);
    } catch {
      return '[unserializable]';
    }
  }

  private logSendFailure(templateName: string, error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    if (error instanceof NotificationHttpError) {
      this.logger.error(
        `Failed to send ${templateName} notification: ${message}. status=${error.status ?? 'n/a'} response=${this.formatResponseData(error.responseBody)}`,
      );
      return;
    }

    this.logger.error(
      `Failed to send ${templateName} notification: ${message}`,
    );
  }
}
