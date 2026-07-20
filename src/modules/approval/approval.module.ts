import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalDelegation } from 'src/database/entities/approval-delegation.entity';
import { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import { Department } from 'src/database/entities/department.entity';
import { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { Role } from 'src/database/entities/role.entity';
import { User } from 'src/database/entities/user.entity';
import { BudgetModule } from '../budget/budget.module';
import { ExportModule } from '../export/export.module';
import { APPROVAL_ESCALATION_QUEUE } from './constants/approval-queue';
import { APPROVAL_SERVICE } from './contracts/approval.contract';
import { APPROVAL_LEVEL_SERVICE } from './contracts/approval-level.contract';
import { DELEGATION_SERVICE } from './contracts/delegation.contract';
import { ApprovalController } from './controllers/approval.controller';
import { ApprovalLevelController } from './controllers/approval-level.controller';
import { DelegationController } from './controllers/delegation.controller';
import { ApprovalEscalationListener } from './listeners/approval-escalation.listener';
import { ApprovalDomainEventRegistrar } from './registrars/approval-domain-event.registrar';
import { ApprovalExportJobRegistrar } from './registrars/approval-export-job.registrar';
import { ApprovalEscalationService } from './services/approval-escalation.service';
import { ApprovalLevelCatalogService } from './services/approval-level-catalog.service';
import { ApprovalLevelService } from './services/approval-level.service';
import { ApprovalRoutingService } from './services/approval-routing.service';
import { ApprovalService } from './services/approval.service';
import { ActionableApprovalQueueService } from './services/actionable-approval-queue.service';
import { DelegationService } from './services/delegation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expense,
      ExpenseApproval,
      ApprovalLevel,
      ApprovalDelegation,
      Department,
      Role,
      User,
    ]),
    BullModule.registerQueue({ name: APPROVAL_ESCALATION_QUEUE }),
    BudgetModule,
    forwardRef(() => ExportModule),
  ],
  controllers: [
    ApprovalController,
    ApprovalLevelController,
    DelegationController,
  ],
  providers: [
    ApprovalRoutingService,
    ApprovalLevelCatalogService,
    ApprovalService,
    DelegationService,
    ActionableApprovalQueueService,
    ApprovalLevelService,
    ApprovalEscalationService,
    ApprovalEscalationListener,
    ApprovalDomainEventRegistrar,
    ApprovalExportJobRegistrar,
    { provide: APPROVAL_SERVICE, useExisting: ApprovalService },
    {
      provide: APPROVAL_LEVEL_SERVICE,
      useExisting: ApprovalLevelService,
    },
    { provide: DELEGATION_SERVICE, useExisting: DelegationService },
  ],
  exports: [
    ApprovalService,
    APPROVAL_SERVICE,
    ApprovalLevelService,
    APPROVAL_LEVEL_SERVICE,
    ApprovalRoutingService,
    ApprovalLevelCatalogService,
    DelegationService,
    DELEGATION_SERVICE,
    ActionableApprovalQueueService,
    ApprovalEscalationListener,
  ],
})
export class ApprovalModule {}
