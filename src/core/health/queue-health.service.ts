import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  OUTBOX_RELAY_QUEUE,
  DOMAIN_EVENT_QUEUE,
} from 'src/core/outbox/constants/outbox-queue.constants';
import { EXPORT_QUEUE } from 'src/modules/export/constants/export-queue.constants';
import { EMAIL_NOTIFICATION_QUEUE } from 'src/modules/notification/constants/notification-queue';
import { APPROVAL_ESCALATION_QUEUE } from 'src/modules/approval/constants/approval-queue';
import { BUDGET_RECONCILIATION_QUEUE } from 'src/modules/budget/constants/budget-reconciliation.constants';
import type { QueueHealthCheck } from './health.types';

const CRITICAL_QUEUES = [
  OUTBOX_RELAY_QUEUE,
  DOMAIN_EVENT_QUEUE,
  EXPORT_QUEUE,
  EMAIL_NOTIFICATION_QUEUE,
  APPROVAL_ESCALATION_QUEUE,
  BUDGET_RECONCILIATION_QUEUE,
] as const;

@Injectable()
export class QueueHealthService {
  constructor(
    @InjectQueue(OUTBOX_RELAY_QUEUE) private readonly outboxRelayQueue: Queue,
    @InjectQueue(DOMAIN_EVENT_QUEUE) private readonly domainEventQueue: Queue,
    @InjectQueue(EXPORT_QUEUE) private readonly exportQueue: Queue,
    @InjectQueue(EMAIL_NOTIFICATION_QUEUE)
    private readonly emailNotificationQueue: Queue,
    @InjectQueue(APPROVAL_ESCALATION_QUEUE)
    private readonly approvalEscalationQueue: Queue,
    @InjectQueue(BUDGET_RECONCILIATION_QUEUE)
    private readonly budgetReconciliationQueue: Queue,
  ) {}

  private queueByName(name: (typeof CRITICAL_QUEUES)[number]): Queue {
    switch (name) {
      case OUTBOX_RELAY_QUEUE:
        return this.outboxRelayQueue;
      case DOMAIN_EVENT_QUEUE:
        return this.domainEventQueue;
      case EXPORT_QUEUE:
        return this.exportQueue;
      case EMAIL_NOTIFICATION_QUEUE:
        return this.emailNotificationQueue;
      case APPROVAL_ESCALATION_QUEUE:
        return this.approvalEscalationQueue;
      case BUDGET_RECONCILIATION_QUEUE:
        return this.budgetReconciliationQueue;
      default:
        throw new Error(`Unknown queue: ${name as string}`);
    }
  }

  async checkQueues(): Promise<Record<string, QueueHealthCheck>> {
    const entries = await Promise.all(
      CRITICAL_QUEUES.map(async (name) => {
        const check = await this.checkQueue(name);
        return [name, check] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  private async checkQueue(
    name: (typeof CRITICAL_QUEUES)[number],
  ): Promise<QueueHealthCheck> {
    const start = Date.now();
    try {
      const counts = await this.queueByName(name).getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      return {
        status: 'up',
        latencyMs: Date.now() - start,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        waiting: -1,
        active: -1,
        delayed: -1,
        failed: -1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
