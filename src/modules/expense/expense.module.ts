import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/database/entities/audit-log.entity';
import { Department } from 'src/database/entities/department.entity';
import { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';
import { ExpenseComment } from 'src/database/entities/expense-comment.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { User } from 'src/database/entities/user.entity';
import { ApprovalModule } from '../approval/approval.module';
import { BudgetModule } from '../budget/budget.module';
import { ExportModule } from '../export/export.module';
import { PolicyModule } from '../policy/policy.module';
import { ReportModule } from '../report/report.module';
import { EXPENSE_SERVICE } from './contracts/expense.contract';
import { ExpenseController } from './controllers/expense.controller';
import { ExpenseCommentService } from './services/expense-comment.service';
import { ExpenseDraftService } from './services/expense-draft.service';
import { ExpenseMutationSupport } from './services/expense-mutation.support';
import { ExpenseQueryService } from './services/expense-query.service';
import { ExpenseReimbursementService } from './services/expense-reimbursement.service';
import { ExpenseSubmitService } from './services/expense-submit.service';
import { ExpenseService } from './services/expense.service';
import { ExpenseExportJobRegistrar } from './registrars/expense-export-job.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expense,
      User,
      Department,
      ExpenseComment,
      ExpenseApproval,
      AuditLog,
      ExpensePolicy,
      ExpenseAttachment,
    ]),
    BudgetModule,
    ReportModule,
    ApprovalModule,
    PolicyModule,
    forwardRef(() => ExportModule),
  ],
  controllers: [ExpenseController],
  providers: [
    ExpenseMutationSupport,
    ExpenseQueryService,
    ExpenseDraftService,
    ExpenseSubmitService,
    ExpenseReimbursementService,
    ExpenseService,
    ExpenseCommentService,
    ExpenseExportJobRegistrar,
    { provide: EXPENSE_SERVICE, useExisting: ExpenseService },
  ],
  exports: [ExpenseService, EXPENSE_SERVICE],
})
export class ExpenseModule {}
