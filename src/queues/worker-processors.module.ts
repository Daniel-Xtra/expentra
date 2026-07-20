import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DOMAIN_EVENT_QUEUE,
  OUTBOX_RELAY_QUEUE,
} from 'src/core/outbox/constants/outbox-queue.constants';
import { OutboxModule } from 'src/core/outbox/outbox.module';
import { DomainEventProcessor } from 'src/core/outbox/processors/domain-event.processor';
import { OutboxRelayProcessor } from 'src/core/outbox/processors/outbox-relay.processor';
import { OutboxRelaySchedulerService } from 'src/core/outbox/services/outbox-relay-scheduler.service';
import { Expense } from 'src/database/entities/expense.entity';
import { EMAIL_NOTIFICATION_QUEUE } from 'src/modules/notification/constants/notification-queue';
import { EmailNotificationProcessor } from 'src/modules/notification/processors/email-notification.processor';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { EXPORT_QUEUE } from 'src/modules/export/constants/export-queue.constants';
import { ExportProcessor } from 'src/modules/export/processors/export.processor';
import { ExportModule } from 'src/modules/export/export.module';
import { BUDGET_RECONCILIATION_QUEUE } from 'src/modules/budget/constants/budget-reconciliation.constants';
import { BudgetReconciliationProcessor } from 'src/modules/budget/processors/budget-reconciliation.processor';
import { BudgetReconciliationSchedulerService } from 'src/modules/budget/services/budget-reconciliation-scheduler.service';
import { BudgetModule } from 'src/modules/budget/budget.module';
import { APPROVAL_ESCALATION_QUEUE } from 'src/modules/approval/constants/approval-queue';
import { ApprovalEscalationProcessor } from 'src/modules/approval/processors/approval-escalation.processor';
import { ApprovalModule } from 'src/modules/approval/approval.module';

/**
 * Registers BullMQ processors and worker-only schedulers.
 * Import only from WorkerModule — never from AppModule.
 */
@Module({
  imports: [
    OutboxModule,
    NotificationModule,
    ExportModule,
    BudgetModule,
    ApprovalModule,
    TypeOrmModule.forFeature([Expense]),
    BullModule.registerQueue(
      { name: OUTBOX_RELAY_QUEUE },
      { name: DOMAIN_EVENT_QUEUE },
      { name: EMAIL_NOTIFICATION_QUEUE },
      { name: EXPORT_QUEUE },
      { name: APPROVAL_ESCALATION_QUEUE },
      { name: BUDGET_RECONCILIATION_QUEUE },
    ),
  ],
  providers: [
    OutboxRelayProcessor,
    DomainEventProcessor,
    EmailNotificationProcessor,
    ExportProcessor,
    ApprovalEscalationProcessor,
    BudgetReconciliationProcessor,
    OutboxRelaySchedulerService,
    BudgetReconciliationSchedulerService,
  ],
})
export class WorkerProcessorsModule {}
