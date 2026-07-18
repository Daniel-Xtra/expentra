import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ExportJobHandlerRegistry } from 'src/modules/export/services/export-job-handler.registry';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { excelExportFromCsv } from 'src/modules/export/utils/excel-export.util';
import {
  DASHBOARD_SERVICE,
  type IDashboardService,
} from '../contracts/dashboard.contract';

@Injectable()
export class DashboardExportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ExportJobHandlerRegistry,
    @Inject(DASHBOARD_SERVICE)
    private readonly dashboardService: IDashboardService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      jobTypes: [
        ExportJobType.DASHBOARD_PERSONAL_XLSX,
        ExportJobType.DASHBOARD_PERSONAL_CSV,
      ],
      generate: async (request, authUser) => {
        const csv = await this.dashboardService.exportPersonalDashboardCsv(
          authUser,
          request.params as never,
        );
        return excelExportFromCsv(csv, 'personal-expense-summary.xlsx');
      },
    });
  }
}
