import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { successRequestResponse } from 'src/core/utils/helper';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
  RequireAnyPermission,
} from 'src/modules/authorization';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from '../contracts/budget.contract';
import { BudgetSummaryQueryDto } from '../dtos/budget-summary.query.dto';
import { BudgetAlertService } from '../services/budget-alert.service';
import { CreateBudgetDto } from '../dtos/create-budget.dto';
import { ListBudgetsQueryDto } from '../dtos/list-budgets.query.dto';
import { UpdateBudgetDto } from '../dtos/update-budget.dto';
import { ExportService } from 'src/modules/export/services/export.service';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { exportQueuedResponse } from 'src/modules/export/utils/export-response.util';
import {
  toBudgetResponse,
  toBudgetSummaryResponse,
} from '../mappers/budget-response.mapper';

@Controller({ path: 'budgets', version: '1' })
export class BudgetController {
  constructor(
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly budgetAlertService: BudgetAlertService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.BUDGET)
  async create(@Body() payload: CreateBudgetDto) {
    const budget = await this.budgetService.create(payload);
    return successRequestResponse(
      'Department budget created',
      toBudgetResponse(budget),
    );
  }

  @Get(['', 'all'])
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.BUDGET)
  async findAll(@Query() query: ListBudgetsQueryDto) {
    const result = await this.budgetService.findAllBudgets(query);
    return successRequestResponse(
      'Budgets fetched successfully',
      result.data.map(toBudgetResponse),
      result.meta,
    );
  }

  @Get('organization/summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.BUDGET)
  async organizationSummary(@Query() query: BudgetSummaryQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    const summary = await this.budgetService.getOrganizationSummary(year);
    return successRequestResponse(
      'Organization budget summary fetched',
      summary,
    );
  }

  @Get('organization/by-department')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.BUDGET)
  async committedByDepartment(@Query() query: BudgetSummaryQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    const rows = await this.budgetService.getCommittedByDepartment(year);
    return successRequestResponse('Department committed spend fetched', rows);
  }

  @Get('organization/forecast')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.BUDGET)
  async organizationForecast(@Query() query: BudgetSummaryQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    const summary = await this.budgetService.getOrganizationSummary(year);
    if (!summary.hasBudget) {
      return successRequestResponse('No active budgets found for forecast', {
        hasBudget: false,
      });
    }

    const forecast = this.budgetAlertService.getForecast(
      summary.amountLimit,
      summary.committedAmount,
      summary.year,
    );

    return successRequestResponse('Organization budget forecast retrieved', {
      hasBudget: true,
      ...forecast,
    });
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.READ, PermissionResource.BUDGET)
  async exportCsv(
    @AuthUser() authUser: IAuthUser,
    @Query() query: ListBudgetsQueryDto,
  ) {
    const result = await this.exportService.queueExport({
      authUser,
      jobType: ExportJobType.BUDGET_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }

  @Get('me/summary')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(
    [PermissionAction.READ, PermissionResource.BUDGET],
    [PermissionAction.READ, PermissionResource.DASHBOARD],
  )
  async mySummary(
    @AuthUser() authUser: IAuthUser,
    @Query() query: BudgetSummaryQueryDto,
  ) {
    const summary = await this.budgetService.getSummaryForUser(
      authUser.id,
      query.year,
    );
    if (!summary) {
      return successRequestResponse(
        'No department assigned for budget tracking',
        {
          hasBudget: false,
        },
      );
    }
    return successRequestResponse(
      'Budget summary fetched',
      toBudgetSummaryResponse(summary),
    );
  }

  @Patch(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.BUDGET)
  async update(
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdateBudgetDto,
  ) {
    const budget = await this.budgetService.update(reference, payload);
    return successRequestResponse(
      'Budget updated successfully',
      toBudgetResponse(budget),
    );
  }
}
