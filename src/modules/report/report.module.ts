import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/database/entities/audit-log.entity';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { User } from 'src/database/entities/user.entity';
import { ExportModule } from '../export/export.module';
import { REPORT_SERVICE } from './contracts/report.contract';
import { ReportController } from './controllers/report.controller';
import { ReportService } from './services/report.service';
import { ReportExportJobRegistrar } from './registrars/report-export-job.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      DepartmentBudget,
      Expense,
      User,
      AuditLog,
      ExpensePolicy,
    ]),
    forwardRef(() => ExportModule),
  ],
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportExportJobRegistrar,
    { provide: REPORT_SERVICE, useExisting: ReportService },
  ],
  exports: [ReportService, REPORT_SERVICE],
})
export class ReportModule {}
