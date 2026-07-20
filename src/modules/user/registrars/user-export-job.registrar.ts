import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ExportJobHandlerRegistry } from 'src/modules/export/services/export-job-handler.registry';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { excelExportFromCsv } from 'src/modules/export/utils/excel-export.util';
import { USER_SERVICE, type IUserService } from '../contracts/user.contract';

@Injectable()
export class UserExportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ExportJobHandlerRegistry,
    @Inject(USER_SERVICE) private readonly userService: IUserService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      jobTypes: [ExportJobType.USER_XLSX, ExportJobType.USER_CSV],
      generate: async (request) => {
        const csv = await this.userService.buildUsersExportCsv(request.params);
        return excelExportFromCsv(csv, 'users.xlsx');
      },
    });
  }
}
