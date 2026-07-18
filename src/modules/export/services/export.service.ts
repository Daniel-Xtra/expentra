import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { JobCorrelationService } from 'src/core/correlation/job-correlation.service';
import { RateLimiterService } from 'src/core/rate-limiter/rate-limiter.service';
import type { IAuthUser } from 'src/definition';
import {
  EXPORT_QUEUE,
  EXPORT_QUEUE_MAX_ATTEMPTS,
} from '../constants/export-queue.constants';
import {
  EXPORT_QUEUE_RATE_LIMIT,
  EXPORT_QUEUE_RATE_LIMIT_TTL_SECONDS,
} from '../constants/export-rate-limit.constants';
import {
  ExportJobType,
  type ExportJobQueueData,
  type QueuedExportResult,
} from '../types/export.types';

export type QueueExportInput = {
  authUser: IAuthUser;
  jobType: ExportJobType;
  params?: object;
  recipientEmail?: string;
};

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectQueue(EXPORT_QUEUE)
    private readonly exportQueue: Queue<ExportJobQueueData>,
    private readonly jobCorrelation: JobCorrelationService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async queueExport(input: QueueExportInput): Promise<QueuedExportResult> {
    await this.assertExportRateLimit(input.authUser.id);

    const recipientEmail = input.recipientEmail?.trim() || input.authUser.email;
    const params = (input.params ?? {}) as Record<string, unknown>;
    const dedupHash = this.buildDedupHash(
      input.authUser.id,
      input.jobType,
      params,
    );

    const queueData = this.jobCorrelation.attach({
      userId: input.authUser.id,
      recipientEmail,
      jobType: input.jobType,
      params,
    });

    await this.exportQueue.add('generate-and-email', queueData, {
      jobId: `export-${dedupHash}`,
      attempts: EXPORT_QUEUE_MAX_ATTEMPTS,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });

    this.logger.log(
      `Queued export ${input.jobType} for ${recipientEmail} (dedup ${dedupHash.slice(0, 8)})`,
    );

    return { status: 'queued', jobType: input.jobType };
  }

  private async assertExportRateLimit(userId: number): Promise<void> {
    const result = await this.rateLimiter.checkRateLimit(
      'export.queue',
      `user:${userId}`,
      EXPORT_QUEUE_RATE_LIMIT,
      EXPORT_QUEUE_RATE_LIMIT_TTL_SECONDS * 1000,
      true,
    );

    if (!result.allowed) {
      throw new HttpException(
        'Export rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private buildDedupHash(
    userId: number,
    jobType: ExportJobType,
    params: Record<string, unknown>,
  ): string {
    return crypto
      .createHash('sha256')
      .update(`${userId}:${jobType}:${JSON.stringify(params)}`)
      .digest('hex');
  }
}
