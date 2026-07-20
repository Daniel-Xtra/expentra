import { Injectable, Logger } from '@nestjs/common';

import { DomainEventHandlerRegistry } from './domain-event-handler.registry';

@Injectable()
export class DomainEventDispatcherService {
  private readonly logger = new Logger(DomainEventDispatcherService.name);

  constructor(private readonly handlerRegistry: DomainEventHandlerRegistry) {}

  async dispatch(
    eventType: string,

    payload: Record<string, unknown>,

    outboxEventId: number,
  ): Promise<void> {
    const handlers = this.handlerRegistry.resolve(
      eventType,
      payload,
      outboxEventId,
    );

    if (handlers.length === 0) {
      this.logger.debug(`No handlers registered for event ${eventType}`);

      return;
    }

    const results = await Promise.allSettled(
      handlers.map((handler) => handler()),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        this.logger.error(
          `Domain event handler failed for ${eventType}: ${reason}`,
        );

        throw result.reason;
      }
    }
  }
}
