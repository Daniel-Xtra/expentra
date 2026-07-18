import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { OutboxService } from './outbox.service';

export type PublishDomainEventOptions = {  manager?: EntityManager;
  idempotencyKey?: string;
};

@Injectable()
export class DomainEventPublisher {
  constructor(private readonly outboxService: OutboxService) {}

  async publish(
    eventType: string,
    payload: Record<string, unknown>,
    options?: PublishDomainEventOptions,
  ): Promise<void> {
    await this.outboxService.append(options?.manager ?? null, {
      eventType,
      payload,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
