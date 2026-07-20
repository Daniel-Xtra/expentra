import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ExportJobHandlerRegistry } from 'src/modules/export/services/export-job-handler.registry';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { excelExportFromCsv } from 'src/modules/export/utils/excel-export.util';
import {
  EXPENSE_SERVICE,
  type IExpenseService,
} from '../contracts/expense.contract';

@Injectable()
export class ExpenseExportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ExportJobHandlerRegistry,
    @Inject(EXPENSE_SERVICE) private readonly expenseService: IExpenseService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      jobTypes: [
        ExportJobType.EXPENSE_PERSONAL_XLSX,
        ExportJobType.EXPENSE_ALL_XLSX,
        ExportJobType.EXPENSE_PAYROLL_XLSX,
        ExportJobType.EXPENSE_PERSONAL_CSV,
        ExportJobType.EXPENSE_ALL_CSV,
        ExportJobType.EXPENSE_PAYROLL_CSV,
      ],
      generate: async (request, authUser) => {
        switch (request.jobType) {
          case ExportJobType.EXPENSE_PERSONAL_XLSX:
          case ExportJobType.EXPENSE_PERSONAL_CSV: {
            const csv =
              await this.expenseService.buildPersonalExpensesExportCsv(
                authUser,
                request.params,
              );
            return excelExportFromCsv(csv, 'my-expenses.xlsx');
          }
          case ExportJobType.EXPENSE_ALL_XLSX:
          case ExportJobType.EXPENSE_ALL_CSV: {
            const csv = await this.expenseService.buildAllExpensesExportCsv(
              authUser,
              request.params,
            );
            return excelExportFromCsv(csv, 'expenses.xlsx');
          }
          case ExportJobType.EXPENSE_PAYROLL_XLSX:
          case ExportJobType.EXPENSE_PAYROLL_CSV: {
            const csv =
              await this.expenseService.buildPayrollExportCsv(authUser);
            return excelExportFromCsv(csv, 'payroll-reimbursements.xlsx');
          }
          default:
            throw new Error(`Unsupported expense export: ${request.jobType}`);
        }
      },
    });
  }
}
