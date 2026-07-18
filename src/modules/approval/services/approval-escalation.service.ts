import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { JobCorrelationService } from 'src/core/correlation/job-correlation.service';
import { APPROVAL_ESCALATION_QUEUE } from '../constants/approval-queue';
import type { ApprovalEscalationJobPayload } from '../types/approval-job.types';

@Injectable()
export class ApprovalEscalationService {
  private readonly logger = new Logger(ApprovalEscalationService.name);

  constructor(
    @InjectQueue(APPROVAL_ESCALATION_QUEUE)
    private readonly escalationQueue: Queue<ApprovalEscalationJobPayload>,
    private readonly configService: ConfigService,
    private readonly jobCorrelation: JobCorrelationService,
  ) {}

  async scheduleForExpense(expenseId: number): Promise<void> {
    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      this.logger.warn(
        `Skipping approval escalation schedule for invalid expense id: ${String(expenseId)}`,
      );
      return;
    }

    const delayHours = this.configService.get<number>(
      'APPROVAL_ESCALATION_DELAY_HOURS',
      72,
    );
    const delayMs = delayHours * 60 * 60 * 1000;
    const jobId = `escalation-${expenseId}`;

    const existing = await this.escalationQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }

    await this.escalationQueue.add(
      'check-pending',
      this.jobCorrelation.attach({ expenseId }),
      { delay: delayMs, jobId, removeOnComplete: true },
    );

    this.logger.debug(
      `Scheduled approval escalation for expense ${expenseId} in ${delayHours}h`,
    );
  }
}
