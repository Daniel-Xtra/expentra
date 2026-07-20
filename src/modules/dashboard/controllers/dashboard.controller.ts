import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { successRequestResponse } from 'src/core/utils/helper';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import { PersonalExpenseAnalyticsQueryDto } from 'src/modules/expense/dtos/personal-expense-analytics.query.dto';
import { ExportService } from 'src/modules/export/services/export.service';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { exportQueuedResponse } from 'src/modules/export/utils/export-response.util';
import {
  DASHBOARD_SERVICE,
  type IDashboardService,
} from '../contracts/dashboard.contract';

@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(
    @Inject(DASHBOARD_SERVICE)
    private readonly dashboardService: IDashboardService,
    private readonly exportService: ExportService,
  ) {}

  @Get('personal')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.DASHBOARD)
  async getPersonal(
    @AuthUser() user: IAuthUser,
    @Query() query: PersonalExpenseAnalyticsQueryDto,
  ) {
    const dashboard = await this.dashboardService.getPersonalDashboard(
      user,
      query,
    );
    return successRequestResponse(
      'Personal dashboard retrieved successfully',
      dashboard,
    );
  }

  @Post('personal/export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.READ, PermissionResource.DASHBOARD)
  async exportPersonal(
    @AuthUser() user: IAuthUser,
    @Query() query: PersonalExpenseAnalyticsQueryDto,
  ) {
    const result = await this.exportService.queueExport({
      authUser: user,
      jobType: ExportJobType.DASHBOARD_PERSONAL_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }
}
