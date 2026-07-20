import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { Department } from 'src/database/entities/department.entity';
import { User } from 'src/database/entities/user.entity';
import { BudgetAlertDispatch } from 'src/database/entities/budget-alert-dispatch.entity';
import { ExportModule } from '../export/export.module';
import { BUDGET_RECONCILIATION_QUEUE } from './constants/budget-reconciliation.constants';
import { BUDGET_SERVICE } from './contracts/budget.contract';
import { BudgetController } from './controllers/budget.controller';
import { BudgetAlertRecipientQueryService } from './services/budget-alert-recipient-query.service';
import { BudgetAlertService } from './services/budget-alert.service';
import { BudgetService } from './services/budget.service';
import { ExpenseBudgetImpactListener } from './listeners/expense-budget-impact.listener';
import { BudgetDomainEventRegistrar } from './registrars/budget-domain-event.registrar';
import { BudgetExportJobRegistrar } from './registrars/budget-export-job.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalLevel,
      DepartmentBudget,
      Department,
      User,
      BudgetAlertDispatch,
    ]),
    BullModule.registerQueue({ name: BUDGET_RECONCILIATION_QUEUE }),
    forwardRef(() => ExportModule),
  ],
  controllers: [BudgetController],
  providers: [
    BudgetService,
    BudgetAlertRecipientQueryService,
    BudgetAlertService,
    ExpenseBudgetImpactListener,
    BudgetDomainEventRegistrar,
    BudgetExportJobRegistrar,
    { provide: BUDGET_SERVICE, useExisting: BudgetService },
  ],
  exports: [
    BudgetService,
    BUDGET_SERVICE,
    BudgetAlertService,
    ExpenseBudgetImpactListener,
  ],
})
export class BudgetModule {}
