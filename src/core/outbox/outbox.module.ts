import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from 'src/core/redis/redis.module';
import { OutboxEvent } from 'src/database/entities/outbox-event.entity';
import {
  DOMAIN_EVENT_QUEUE,
  OUTBOX_RELAY_QUEUE,
} from './constants/outbox-queue.constants';
import { DomainEventDispatcherService } from './services/domain-event-dispatcher.service';
import { DomainEventHandlerRegistry } from './services/domain-event-handler.registry';
import { DomainEventIdempotencyService } from './services/domain-event-idempotency.service';
import { DomainEventPublisher } from './services/domain-event.publisher';
import { OutboxService } from './services/outbox.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent]),
    RedisModule,
    BullModule.registerQueue(
      { name: OUTBOX_RELAY_QUEUE },
      { name: DOMAIN_EVENT_QUEUE },
    ),
  ],
  providers: [
    OutboxService,
    DomainEventPublisher,
    DomainEventIdempotencyService,
    DomainEventHandlerRegistry,
    DomainEventDispatcherService,
  ],
  exports: [
    DomainEventPublisher,
    OutboxService,
    DomainEventHandlerRegistry,
    DomainEventDispatcherService,
    BullModule,
  ],
})
export class OutboxModule {}
