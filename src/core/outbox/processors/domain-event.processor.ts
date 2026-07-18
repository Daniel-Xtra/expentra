import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CorrelationContextService } from 'src/core/correlation/correlation-context.service';
import {
  DOMAIN_EVENT_MAX_ATTEMPTS,
  DOMAIN_EVENT_QUEUE,
} from '../constants/outbox-queue.constants';
import { DomainEventDispatcherService } from '../services/domain-event-dispatcher.service';
import { OutboxService } from '../services/outbox.service';
import type { DomainEventJobData } from '../types/domain-event-job.types';
import { redactProcessedDomainEventPayload } from '../utils/domain-event-payload-redaction.util';

@Processor(DOMAIN_EVENT_QUEUE)
export class DomainEventProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainEventProcessor.name);

  constructor(
    private readonly dispatcher: DomainEventDispatcherService,
    private readonly outboxService: OutboxService,
    private readonly correlationContext: CorrelationContextService,
  ) {
    super();
  }

  async process(
    job: Parameters<WorkerHost['process']>[0],
    _token?: string,
  ): Promise<void> {
    const data = (job.data ?? {}) as DomainEventJobData;
    const run = async (): Promise<void> => {
      await this.dispatcher.dispatch(
        data.eventType,
        data.payload,
        data.outboxEventId,
      );
      await this.outboxService.markProcessed(
        data.outboxEventId,
        redactProcessedDomainEventPayload(data.eventType, data.payload),
      );
    };

    if (data.correlationId) {
      await this.correlationContext.run(data.correlationId, run);
      return;
    }

    await run();
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Parameters<WorkerHost['process']>[0] | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? DOMAIN_EVENT_MAX_ATTEMPTS;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    const data = (job.data ?? {}) as Partial<DomainEventJobData>;
    if (data.outboxEventId) {
      await this.outboxService.clearDispatched(data.outboxEventId);
    }
    this.logger.error(
      `Domain event job exhausted retries for outbox ${data.outboxEventId ?? 'unknown'} (${data.eventType ?? 'unknown'}): ${error.message}`,
    );
  }
}
