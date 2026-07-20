import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  OUTBOX_RELAY_QUEUE,
  DOMAIN_EVENT_QUEUE,
} from 'src/core/outbox/constants/outbox-queue.constants';
import { OutboxModule } from 'src/core/outbox/outbox.module';
import { RedisModule } from 'src/core/redis/redis.module';
import { EXPORT_QUEUE } from 'src/modules/export/constants/export-queue.constants';
import { EMAIL_NOTIFICATION_QUEUE } from 'src/modules/notification/constants/notification-queue';
import { APPROVAL_ESCALATION_QUEUE } from 'src/modules/approval/constants/approval-queue';
import { BUDGET_RECONCILIATION_QUEUE } from 'src/modules/budget/constants/budget-reconciliation.constants';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { QueueHealthService } from './queue-health.service';

@Module({
  imports: [
    RedisModule,
    OutboxModule,
    BullModule.registerQueue(
      { name: OUTBOX_RELAY_QUEUE },
      { name: DOMAIN_EVENT_QUEUE },
      { name: EXPORT_QUEUE },
      { name: EMAIL_NOTIFICATION_QUEUE },
      { name: APPROVAL_ESCALATION_QUEUE },
      { name: BUDGET_RECONCILIATION_QUEUE },
    ),
  ],
  controllers: [HealthController],
  providers: [HealthService, QueueHealthService],
  exports: [HealthService, QueueHealthService],
})
export class HealthModule {}
