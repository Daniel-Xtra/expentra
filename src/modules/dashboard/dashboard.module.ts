import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { BudgetModule } from '../budget/budget.module';
import { ExportModule } from '../export/export.module';
import { DASHBOARD_SERVICE } from './contracts/dashboard.contract';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { DashboardExportJobRegistrar } from './registrars/dashboard-export-job.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpensePolicy]),
    BudgetModule,
    forwardRef(() => ExportModule),
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardExportJobRegistrar,
    { provide: DASHBOARD_SERVICE, useExisting: DashboardService },
  ],
  exports: [DashboardService, DASHBOARD_SERVICE],
})
export class DashboardModule {}
