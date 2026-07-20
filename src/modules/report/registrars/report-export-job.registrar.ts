import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ExportJobHandlerRegistry } from 'src/modules/export/services/export-job-handler.registry';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { excelExportFromCsv } from 'src/modules/export/utils/excel-export.util';
import {
  REPORT_SERVICE,
  type IReportService,
} from '../contracts/report.contract';

@Injectable()
export class ReportExportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ExportJobHandlerRegistry,
    @Inject(REPORT_SERVICE) private readonly reportService: IReportService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      jobTypes: [
        ExportJobType.REPORT_SPENDING_XLSX,
        ExportJobType.REPORT_SPENDING_CSV,
        ExportJobType.REPORT_SPENDING_PDF,
      ],
      generate: async (request, authUser) => {
        if (
          request.jobType === ExportJobType.REPORT_SPENDING_XLSX ||
          request.jobType === ExportJobType.REPORT_SPENDING_CSV
        ) {
          const rows = await this.reportService.getExpenseExportRows(
            authUser,
            request.params as never,
          );
          const csv = this.reportService.buildExpensesCsv(rows);
          return excelExportFromCsv(csv, 'expenses-export.xlsx');
        }

        const pdf = await this.reportService.buildSpendingReportPdf(
          authUser,
          request.params as never,
        );
        return {
          buffer: pdf,
          fileName: 'spending-report.pdf',
          mimeType: 'application/pdf',
        };
      },
    });
  }
}
