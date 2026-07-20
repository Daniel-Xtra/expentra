import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatCorrelationLogSuffix } from 'src/core/correlation/correlation-log.util';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { APPROVAL_ESCALATION_QUEUE } from '../constants/approval-queue';
import type { ApprovalEscalationJobPayload } from '../types/approval-job.types';

@Processor(APPROVAL_ESCALATION_QUEUE)
export class ApprovalEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(ApprovalEscalationProcessor.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {
    super();
  }

  async process(
    job: Parameters<WorkerHost['process']>[0],
    _token?: string,
  ): Promise<void> {
    const { expenseId, correlationId } = (job.data ??
      {}) as ApprovalEscalationJobPayload;

    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      this.logger.warn(
        `Skipping malformed approval escalation job ${job.id ?? 'unknown'}: invalid expenseId ${String(expenseId)}`,
      );
      return;
    }

    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId },
    });

    if (!expense) {
      return;
    }

    if (
      expense.status !== ExpenseStatus.SUBMITTED &&
      expense.status !== ExpenseStatus.UNDER_REVIEW
    ) {
      return;
    }

    this.logger.log(
      `Escalating expense ${expenseId} (status ${expense.status})${formatCorrelationLogSuffix(correlationId)}`,
    );

    await this.domainEventPublisher.publish('expense.escalated', {
      expenseId: expense.id,
      userId: expense.userId,
      status: expense.status,
      correlationId,
    });
  }
}
