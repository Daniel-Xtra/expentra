import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OUTBOX_RELAY_QUEUE } from '../constants/outbox-queue.constants';

/**
 * Registers repeatable outbox relay jobs. Worker-only — do not provide in AppModule.
 */
@Injectable()
export class OutboxRelaySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelaySchedulerService.name);

  constructor(
    @InjectQueue(OUTBOX_RELAY_QUEUE)
    private readonly relayQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.relayQueue.add(
      'poll',
      {},
      {
        repeat: { every: 2000 },
        jobId: 'outbox-relay-poll',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    await this.relayQueue.add(
      'reconcile',
      {},
      {
        repeat: { every: 60_000 },
        jobId: 'outbox-relay-reconcile',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    this.logger.log('Outbox relay poll scheduled (every 2s)');
    this.logger.log('Outbox stuck-event reconciliation scheduled (every 60s)');
  }
}
