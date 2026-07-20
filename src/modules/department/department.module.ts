import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { DepartmentManagerHistory } from 'src/database/entities/department-manager-history.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { User } from 'src/database/entities/user.entity';
import { BudgetModule } from '../budget/budget.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ExportModule } from '../export/export.module';
import { DEPARTMENT_SERVICE } from './contracts/department.contract';
import { DepartmentController } from './controllers/department.controller';
import { DepartmentManagerService } from './services/department-manager.service';
import { DepartmentMutationService } from './services/department-mutation.service';
import { DepartmentQueryService } from './services/department-query.service';
import { DepartmentService } from './services/department.service';
import { DepartmentExportJobRegistrar } from './registrars/department-export-job.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      DepartmentBudget,
      DepartmentManagerHistory,
      User,
      Expense,
    ]),
    forwardRef(() => BudgetModule),
    DashboardModule,
    forwardRef(() => ExportModule),
  ],
  controllers: [DepartmentController],
  providers: [
    DepartmentManagerService,
    DepartmentQueryService,
    DepartmentMutationService,
    DepartmentService,
    DepartmentExportJobRegistrar,
    { provide: DEPARTMENT_SERVICE, useExisting: DepartmentService },
  ],
  exports: [DepartmentService, DEPARTMENT_SERVICE, DepartmentManagerService],
})
export class DepartmentModule {}
