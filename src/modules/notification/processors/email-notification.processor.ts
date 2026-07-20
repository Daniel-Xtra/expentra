import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { formatCorrelationLogSuffix } from 'src/core/correlation/correlation-log.util';
import {
  EXTERNAL_NOTIFICATION_SENDER,
  type IExternalNotificationSender,
} from '../contracts/external-notification.contract';
import { EMAIL_NOTIFICATION_QUEUE } from '../constants/notification-queue';
import { NotificationDispatchService } from '../services/notification-dispatch.service';
import type { EmailNotificationJobData } from '../types/notification-job.types';

@Processor(EMAIL_NOTIFICATION_QUEUE)
export class EmailNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailNotificationProcessor.name);

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    @Inject(EXTERNAL_NOTIFICATION_SENDER)
    private readonly externalSender: IExternalNotificationSender,
  ) {
    super();
  }

  async process(
    job: Parameters<WorkerHost['process']>[0],
    _token?: string,
  ): Promise<void> {
    const {
      notificationReference,
      to,
      template,
      data,
      attachments,
      correlationId,
    } = (job.data ?? {}) as EmailNotificationJobData;
    this.logger.log(
      `Processing email notification ${notificationReference}${formatCorrelationLogSuffix(correlationId)}`,
    );

    if (!template) {
      throw new Error('Email template is missing');
    }

    await this.externalSender.sendEmail({
      to,
      template,
      data: data ?? {},
      attachments,
    });

    await this.dispatchService.markSent(notificationReference);
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Parameters<WorkerHost['process']>[0] | undefined,
    error: Error,
  ): void {
    const jobData = (job?.data ?? {}) as EmailNotificationJobData;
    if (!jobData.notificationReference || !job) {
      this.logger.error(
        `Email job failed: ${error.message}${formatCorrelationLogSuffix(jobData.correlationId)}`,
        error.stack,
      );
      return;
    }

    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < attempts) {
      return;
    }

    void this.dispatchService.markFailed(
      jobData.notificationReference,
      error.message,
    );
    this.logger.error(
      `Email notification ${jobData.notificationReference} failed after ${job.attemptsMade} attempts: ${error.message}${formatCorrelationLogSuffix(jobData.correlationId)}`,
    );
  }
}
