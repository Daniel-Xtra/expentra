export type DomainEventJobData = {
  outboxEventId: number;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string;
};
