import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { formatCorrelationLogSuffix } from 'src/core/correlation/correlation-log.util';
import { NotificationType } from 'src/database/entities/notification.enums';
import { EmailContentBuilder } from 'src/modules/notification/builders/email-content.builder';
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { EXPORT_QUEUE } from '../constants/export-queue.constants';
import { ExportGenerationService } from '../services/export-generation.service';
import type { ExportJobQueueData } from '../types/export.types';

@Processor(EXPORT_QUEUE)
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    private readonly generationService: ExportGenerationService,
    private readonly notificationDispatch: NotificationDispatchService,
    private readonly emailContent: EmailContentBuilder,
  ) {
    super();
  }

  async process(
    job: Parameters<WorkerHost['process']>[0],
    _token?: string,
  ): Promise<void> {
    const data = (job.data ?? {}) as ExportJobQueueData;
    const { userId, recipientEmail, jobType, params, correlationId } = data;

    this.logger.log(
      `Processing export ${jobType} for user ${userId}${formatCorrelationLogSuffix(correlationId)}`,
    );

    const generated = await this.generationService.generateForUser(userId, {
      jobType,
      params: params ?? {},
    });

    const content = this.emailContent.exportReady({
      fileName: generated.fileName,
      exportLabel: this.labelForJobType(jobType),
    });

    await this.notificationDispatch.scheduleEmail({
      userId,
      notificationType: NotificationType.EXPORT_READY,
      to: recipientEmail,
      template: content.template,
      data: content.data,
      attachments: [
        {
          fileName: generated.fileName,
          mimeType: generated.mimeType,
          contentBase64: generated.buffer.toString('base64'),
        },
      ],
    });
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Parameters<WorkerHost['process']>[0] | undefined,
    error: Error,
  ): void {
    const data = (job?.data ?? {}) as Partial<ExportJobQueueData>;
    this.logger.error(
      `Export job failed for ${data.jobType ?? 'unknown'} (user ${data.userId ?? 'unknown'}): ${error.message}`,
    );
  }

  private labelForJobType(jobType: string): string {
    return jobType.replace(/\./g, ' ').replace(/_/g, ' ');
  }
}
