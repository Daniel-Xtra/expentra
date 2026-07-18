import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { JobCorrelationService } from 'src/core/correlation/job-correlation.service';
import { Notification } from 'src/database/entities/notification.entity';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from 'src/database/entities/notification.enums';
import {
  EMAIL_NOTIFICATION_QUEUE,
  EMAIL_QUEUE_MAX_ATTEMPTS,
} from '../constants/notification-queue';
import type { EmailNotificationJobData } from '../types/notification-job.types';
import { NotificationInboxService } from './notification-inbox.service';
import { sanitizeNotificationPayload } from '../utils/sanitize-notification-payload.util';

const ESSENTIAL_AUTH_EMAIL_TYPES = new Set<NotificationType>([
  NotificationType.EMAIL_VERIFICATION,
  NotificationType.PASSWORD_RESET_REQUEST,
]);

export type ScheduleEmailParams = {
  userId: number;
  notificationType: NotificationType;
  to: string;
  template?: string;
  data?: Record<string, unknown>;
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }>;
};

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectQueue(EMAIL_NOTIFICATION_QUEUE)
    private readonly emailQueue: Queue<EmailNotificationJobData>,
    private readonly inboxService: NotificationInboxService,
    private readonly jobCorrelation: JobCorrelationService,
  ) {}

  async scheduleEmail(params: ScheduleEmailParams): Promise<void> {
    if (!ESSENTIAL_AUTH_EMAIL_TYPES.has(params.notificationType)) {
      const emailEnabled = await this.inboxService.isChannelEnabled(
        params.userId,
        'email',
        params.notificationType,
      );
      if (!emailEnabled) {
        this.logger.debug(
          `Skipped ${params.notificationType} email for user ${params.userId} (preferences)`,
        );
        return;
      }
    }

    const persistedPayload = sanitizeNotificationPayload(params.data);

    const row = await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: params.userId,
        type: params.notificationType,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        payload: {
          to: params.to,
          template: params.template,
          ...persistedPayload,
          ...(params.attachments?.length
            ? {
                attachmentNames: params.attachments.map((a) => a.fileName),
              }
            : {}),
        },
      }),
    );

    const jobData = this.jobCorrelation.attach({
      notificationReference: row.reference,
      to: params.to,
      template: params.template,
      data: params.data,
      attachments: params.attachments,
    });

    await this.emailQueue.add('send-email', jobData, {
      attempts: EMAIL_QUEUE_MAX_ATTEMPTS,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    this.logger.debug(
      `Queued ${params.notificationType} email for ${params.to} (notification ${row.reference})`,
    );
  }

  async markSent(notificationReference: string): Promise<void> {
    await this.notificationRepository.update(
      { reference: notificationReference },
      {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        errorMessage: undefined,
      },
    );
  }

  async dispatchInApp(params: {
    userId: number;
    notificationType: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const inAppEnabled = await this.inboxService.isChannelEnabled(
      params.userId,
      'inApp',
      params.notificationType,
    );
    if (!inAppEnabled) {
      return;
    }

    const persistedPayload = sanitizeNotificationPayload(params.data);

    await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: params.userId,
        type: params.notificationType,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        payload: {
          title: params.title,
          body: params.body,
          ...persistedPayload,
        },
      }),
    );
  }

  async markFailed(
    notificationReference: string,
    errorMessage: string,
  ): Promise<void> {
    await this.notificationRepository.update(
      { reference: notificationReference },
      {
        status: NotificationStatus.FAILED,
        errorMessage: errorMessage.slice(0, 4000),
      },
    );
  }
}
