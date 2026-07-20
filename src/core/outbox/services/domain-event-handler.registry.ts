import { Injectable } from '@nestjs/common';
import { DomainEventIdempotencyService } from './domain-event-idempotency.service';

export type DomainEventHandler = () => Promise<void>;

export type DomainHandlerDefinition = {
  name: string;
  run: () => Promise<void>;
};

export type DomainHandlerFactory = (
  payload: Record<string, unknown>,
) => DomainHandlerDefinition[];

@Injectable()
export class DomainEventHandlerRegistry {
  private readonly factories = new Map<string, DomainHandlerFactory[]>();

  constructor(private readonly idempotency: DomainEventIdempotencyService) {}

  register(eventType: string, factory: DomainHandlerFactory): void {
    const existing = this.factories.get(eventType) ?? [];
    existing.push(factory);
    this.factories.set(eventType, existing);
  }

  resolve(
    eventType: string,
    payload: Record<string, unknown>,
    outboxEventId: number,
  ): DomainEventHandler[] {
    const factories = this.factories.get(eventType) ?? [];
    const definitions = factories.flatMap((factory) => factory(payload));
    const entityKey = this.idempotency.resolveEntityKey(outboxEventId);

    return definitions.map(
      (definition) => () =>
        this.idempotency.runOnce(
          eventType,
          definition.name,
          entityKey,
          definition.run,
        ),
    );
  }
}
