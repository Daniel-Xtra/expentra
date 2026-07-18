import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DOMAIN_EVENT_MAX_ATTEMPTS,
  DOMAIN_EVENT_QUEUE,
  OUTBOX_RELAY_QUEUE,
} from '../constants/outbox-queue.constants';
import { OutboxService } from '../services/outbox.service';
import type { DomainEventJobData } from '../types/domain-event-job.types';
import type { OutboxEvent } from 'src/database/entities/outbox-event.entity';

@Processor(OUTBOX_RELAY_QUEUE)
export class OutboxRelayProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxRelayProcessor.name);

  constructor(
    private readonly outboxService: OutboxService,
    @InjectQueue(DOMAIN_EVENT_QUEUE)
    private readonly domainEventQueue: Queue<DomainEventJobData>,
  ) {
    super();
  }

  async process(
    job: Parameters<WorkerHost['process']>[0],
  ): Promise<void> {
    const jobName = job?.name ?? 'poll';

    if (jobName === 'reconcile') {
      await this.outboxService.reclaimStuckDispatched();
      return;
    }

    const events = await this.outboxService.claimPendingBatch(50);
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      try {
        await this.enqueueDomainEvent(event);
      } catch (error: unknown) {
        await this.outboxService.clearDispatched(event.id);
        throw error;
      }
    }

    this.logger.debug(`Relayed ${events.length} outbox event(s) to domain queue`);
  }

  /**
   * Idempotent enqueue. After DB resets, outbox ids restart at 1 while Redis may
   * still hold completed/failed `domain-event-{id}` jobs — remove those first.
   */
  private async enqueueDomainEvent(event: OutboxEvent): Promise<void> {
    const jobId = `domain-event-${event.id}`;
    const existing = await this.domainEventQueue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      } else {
        // waiting / active / delayed / prioritized — already in flight
        this.logger.debug(
          `Skipping outbox ${event.id}; domain job already ${state}`,
        );
        return;
      }
    }

    await this.domainEventQueue.add(
      'dispatch',
      {
        outboxEventId: event.id,
        eventType: event.eventType,
        payload: event.payload,
        correlationId: event.correlationId ?? undefined,
      },
      {
        jobId,
        attempts: DOMAIN_EVENT_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    );
  }
}
