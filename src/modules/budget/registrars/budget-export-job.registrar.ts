import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ExportJobHandlerRegistry } from 'src/modules/export/services/export-job-handler.registry';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { excelExportFromCsv } from 'src/modules/export/utils/excel-export.util';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from '../contracts/budget.contract';

@Injectable()
export class BudgetExportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ExportJobHandlerRegistry,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      jobTypes: [ExportJobType.BUDGET_XLSX, ExportJobType.BUDGET_CSV],
      generate: async (request) => {
        const csv = await this.budgetService.buildBudgetsExportCsv(
          request.params as never,
        );
        return excelExportFromCsv(csv, 'budgets.xlsx');
      },
    });
  }
}
