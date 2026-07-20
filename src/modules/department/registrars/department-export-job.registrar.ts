import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ExportJobHandlerRegistry } from 'src/modules/export/services/export-job-handler.registry';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { excelExportFromCsv } from 'src/modules/export/utils/excel-export.util';
import {
  DEPARTMENT_SERVICE,
  type IDepartmentService,
} from '../contracts/department.contract';

@Injectable()
export class DepartmentExportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ExportJobHandlerRegistry,
    @Inject(DEPARTMENT_SERVICE)
    private readonly departmentService: IDepartmentService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      jobTypes: [ExportJobType.DEPARTMENT_XLSX, ExportJobType.DEPARTMENT_CSV],
      generate: async (request) => {
        const csv = await this.departmentService.buildDepartmentsExportCsv(
          request.params,
        );
        return excelExportFromCsv(csv, 'departments.xlsx');
      },
    });
  }
}
