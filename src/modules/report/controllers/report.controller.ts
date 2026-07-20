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
import {
  REPORT_SERVICE,
  type IReportService,
} from '../contracts/report.contract';
import { SpendingReportQueryDto } from '../dtos/spending-report.query.dto';
import { YearlySpendingQueryDto } from '../dtos/yearly-spending.query.dto';
import { ExportService } from 'src/modules/export/services/export.service';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { exportQueuedResponse } from 'src/modules/export/utils/export-response.util';

@Controller({ path: 'reports', version: '1' })
export class ReportController {
  constructor(
    @Inject(REPORT_SERVICE) private readonly reportService: IReportService,
    private readonly exportService: ExportService,
  ) {}

  @Get('spending/summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.REPORT)
  async getSpendingSummary(
    @AuthUser() authUser: IAuthUser,
    @Query() query: SpendingReportQueryDto,
  ) {
    const summary = await this.reportService.getSpendingSummary(
      authUser,
      query,
    );
    return successRequestResponse(
      'Spending summary fetched successfully',
      summary,
    );
  }

  @Get('spending/monthly')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.REPORT)
  async getSpendingByMonth(
    @AuthUser() authUser: IAuthUser,
    @Query() query: YearlySpendingQueryDto,
  ) {
    const report = await this.reportService.getSpendingByMonth(authUser, query);
    return successRequestResponse(
      'Monthly spending fetched successfully',
      report,
    );
  }

  @Get('spending/by-category')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.REPORT)
  async getSpendingByCategory(
    @AuthUser() authUser: IAuthUser,
    @Query() query: SpendingReportQueryDto,
  ) {
    const rows = await this.reportService.getSpendingByCategory(
      authUser,
      query,
    );
    return successRequestResponse(
      'Spending by category fetched successfully',
      rows,
    );
  }

  @Get('spending/by-department')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.REPORT)
  async getSpendingByDepartment(
    @AuthUser() authUser: IAuthUser,
    @Query() query: SpendingReportQueryDto,
  ) {
    const rows = await this.reportService.getSpendingByDepartment(
      authUser,
      query,
    );
    return successRequestResponse(
      'Spending by department fetched successfully',
      rows,
    );
  }

  @Post('spending/export/excel')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.EXPORT, PermissionResource.REPORT)
  async exportExpensesExcel(
    @AuthUser() authUser: IAuthUser,
    @Query() query: SpendingReportQueryDto,
  ) {
    const result = await this.exportService.queueExport({
      authUser,
      jobType: ExportJobType.REPORT_SPENDING_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }

  @Post('spending/export/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.EXPORT, PermissionResource.REPORT)
  async exportSpendingPdf(
    @AuthUser() authUser: IAuthUser,
    @Query() query: SpendingReportQueryDto,
  ) {
    const result = await this.exportService.queueExport({
      authUser,
      jobType: ExportJobType.REPORT_SPENDING_PDF,
      params: query,
    });
    return exportQueuedResponse(result);
  }
}
