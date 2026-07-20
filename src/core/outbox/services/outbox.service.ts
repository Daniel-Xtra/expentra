import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { EntityManager, IsNull, LessThan, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CorrelationContextService } from 'src/core/correlation/correlation-context.service';
import { OutboxEvent } from 'src/database/entities/outbox-event.entity';
import {
  OUTBOX_RELAY_QUEUE,
  OUTBOX_STUCK_DISPATCHED_MINUTES,
} from '../constants/outbox-queue.constants';

export type AppendOutboxEventInput = {
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    @InjectQueue(OUTBOX_RELAY_QUEUE)
    private readonly relayQueue: Queue,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  async append(
    manager: EntityManager | null,
    input: AppendOutboxEventInput,
  ): Promise<OutboxEvent> {
    const repository = manager
      ? manager.getRepository(OutboxEvent)
      : this.outboxRepository;

    const row = repository.create({
      eventType: input.eventType,
      payload: input.payload,
      correlationId: this.correlationContext.get() ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    });

    const saved = await repository.save(row);
    await this.scheduleRelay();
    return saved;
  }

  async claimPendingBatch(limit = 50): Promise<OutboxEvent[]> {
    return this.outboxRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(OutboxEvent);
      const rows = await repository
        .createQueryBuilder('outbox')
        .where('outbox.processed_at IS NULL')
        .andWhere('outbox.dispatched_at IS NULL')
        .orderBy('outbox.id', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (rows.length === 0) {
        return [];
      }

      const dispatchedAt = new Date();
      await repository
        .createQueryBuilder()
        .update(OutboxEvent)
        .set({ dispatchedAt })
        .whereInIds(rows.map((row) => row.id))
        .execute();

      return rows.map((row) => ({ ...row, dispatchedAt }));
    });
  }

  async countPending(): Promise<number> {
    return this.outboxRepository.count({
      where: { processedAt: IsNull() },
    });
  }

  async oldestPendingAgeSeconds(): Promise<number | null> {
    const oldest = await this.outboxRepository.findOne({
      where: { processedAt: IsNull() },
      order: { createdAt: 'ASC' },
      select: ['id', 'createdAt'],
    });

    if (!oldest) {
      return null;
    }

    return Math.floor((Date.now() - oldest.createdAt.getTime()) / 1000);
  }

  async markDispatched(outboxEventId: number): Promise<void> {
    await this.outboxRepository.update(
      { id: outboxEventId, dispatchedAt: IsNull() },
      { dispatchedAt: new Date() },
    );
  }

  async clearDispatched(outboxEventId: number): Promise<void> {
    await this.outboxRepository.update(
      { id: outboxEventId },
      { dispatchedAt: null },
    );
  }

  async markProcessed(
    outboxEventId: number,
    processedPayload?: Record<string, unknown>,
  ): Promise<void> {
    const update: QueryDeepPartialEntity<OutboxEvent> = {
      processedAt: new Date(),
      ...(processedPayload
        ? {
            payload: processedPayload as QueryDeepPartialEntity<
              Record<string, unknown>
            >,
          }
        : {}),
    };

    await this.outboxRepository.update(
      { id: outboxEventId, processedAt: IsNull() },
      update,
    );
  }

  async reclaimStuckDispatched(): Promise<number> {
    const cutoff = new Date(
      Date.now() - OUTBOX_STUCK_DISPATCHED_MINUTES * 60 * 1000,
    );

    const result = await this.outboxRepository.update(
      {
        processedAt: IsNull(),
        dispatchedAt: LessThan(cutoff),
      },
      { dispatchedAt: null },
    );

    const reclaimed = result.affected ?? 0;
    if (reclaimed > 0) {
      this.logger.warn(
        `Reclaimed ${reclaimed} stuck outbox event(s) for redispatch`,
      );
    }

    return reclaimed;
  }

  private async scheduleRelay(): Promise<void> {
    try {
      await this.relayQueue.add(
        'relay',
        {},
        {
          jobId: `outbox-relay-${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 50,
          delay: 250,
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to schedule outbox relay: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
