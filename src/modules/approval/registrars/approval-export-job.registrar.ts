import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ExportJobHandlerRegistry } from 'src/modules/export/services/export-job-handler.registry';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { excelExportFromCsv } from 'src/modules/export/utils/excel-export.util';
import {
  APPROVAL_LEVEL_SERVICE,
  type IApprovalLevelService,
} from '../contracts/approval-level.contract';

@Injectable()
export class ApprovalExportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ExportJobHandlerRegistry,
    @Inject(APPROVAL_LEVEL_SERVICE)
    private readonly approvalLevelService: IApprovalLevelService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      jobTypes: [
        ExportJobType.APPROVAL_LEVEL_XLSX,
        ExportJobType.APPROVAL_LEVEL_CSV,
      ],
      generate: async (request) => {
        const csv =
          await this.approvalLevelService.buildApprovalLevelsExportCsv(
            request.params,
          );
        return excelExportFromCsv(csv, 'approval-levels.xlsx');
      },
    });
  }
}
