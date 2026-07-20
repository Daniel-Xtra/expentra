import {
  Body,
  Controller,
  Delete,
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
import type { IAuthUser } from 'src/definition';
import { successRequestResponse } from 'src/core/utils/helper';
import {
  PermissionAction,
  PermissionResource,
  RequireManagedDepartmentRead,
  RequirePermission,
} from 'src/modules/authorization';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from 'src/modules/budget/contracts/budget.contract';
import { BudgetSummaryQueryDto } from 'src/modules/budget/dtos/budget-summary.query.dto';
import { BudgetAlertService } from 'src/modules/budget/services/budget-alert.service';
import { toBudgetSummaryResponse } from 'src/modules/budget/mappers/budget-response.mapper';
import {
  DEPARTMENT_SERVICE,
  type IDepartmentService,
} from '../contracts/department.contract';
import { toUserResponse } from 'src/modules/user/mappers/user-response.mapper';
import { CreateDepartmentDto } from '../dtos/create-department.dto';
import { ListDepartmentManagerHistoryQueryDto } from '../dtos/list-department-manager-history.query.dto';
import { ListDepartmentUsersQueryDto } from '../dtos/list-department-users.query.dto';
import { ListDepartmentsQueryDto } from '../dtos/list-departments.query.dto';
import { UpdateDepartmentDto } from '../dtos/update-department.dto';
import { toDepartmentManagerHistoryResponse } from '../mappers/department-manager-history-response.mapper';
import { toDepartmentResponse } from '../mappers/department-response.mapper';
import { ExportService } from 'src/modules/export/services/export.service';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { exportQueuedResponse } from 'src/modules/export/utils/export-response.util';
import {
  DASHBOARD_SERVICE,
  type IDashboardService,
} from 'src/modules/dashboard/contracts/dashboard.contract';
import { PersonalExpenseAnalyticsQueryDto } from 'src/modules/expense/dtos/personal-expense-analytics.query.dto';

@Controller({ path: 'departments', version: '1' })
export class DepartmentController {
  constructor(
    @Inject(DEPARTMENT_SERVICE)
    private readonly departmentService: IDepartmentService,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    @Inject(DASHBOARD_SERVICE)
    private readonly dashboardService: IDashboardService,
    private readonly budgetAlertService: BudgetAlertService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.DEPARTMENT)
  async create(@Body() payload: CreateDepartmentDto) {
    const department = await this.departmentService.create(payload);
    const pendingApprovalCount =
      await this.departmentService.countPendingApprovals(department.id);
    return successRequestResponse(
      'Department created successfully',
      toDepartmentResponse(department, { pendingApprovalCount }),
    );
  }

  @Get(['', 'all'])
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.DEPARTMENT)
  async findAll(@Query() query: ListDepartmentsQueryDto) {
    const result = await this.departmentService.findAllDepartments(query);
    return successRequestResponse(
      'Departments fetched successfully',
      result.data.map((department) => {
        const extras = result.extrasByDepartmentId.get(department.id);
        return toDepartmentResponse(department, {
          pendingApprovalCount: extras?.pendingApprovalCount ?? 0,
          headcount: extras?.headcount,
          hasBudget: extras?.hasBudget,
          utilizationPercent: extras?.utilizationPercent,
          isOverBudget: extras?.isOverBudget,
          isNearLimit: extras?.isNearLimit,
        });
      }),
      result.meta,
    );
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.READ, PermissionResource.DEPARTMENT)
  async exportCsv(
    @AuthUser() authUser: IAuthUser,
    @Query() query: ListDepartmentsQueryDto,
  ) {
    const result = await this.exportService.queueExport({
      authUser,
      jobType: ExportJobType.DEPARTMENT_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }

  @Get('managed')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async findManaged(@AuthUser() authUser: IAuthUser) {
    const departments = await this.departmentService.findManagedDepartments(
      authUser.id,
    );
    const pendingCounts =
      await this.departmentService.countPendingApprovalsForDepartments(
        departments.map((department) => department.id),
      );
    return successRequestResponse(
      'Managed departments fetched successfully',
      departments.map((department) =>
        toDepartmentResponse(department, {
          pendingApprovalCount: pendingCounts.get(department.id) ?? 0,
        }),
      ),
    );
  }

  @Get('managed/:reference/team-dashboard')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async managedTeamDashboard(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: PersonalExpenseAnalyticsQueryDto,
  ) {
    const department = await this.departmentService.findOneForManager(
      authUser.id,
      reference,
    );
    const dashboard = await this.dashboardService.getTeamDashboardForDepartment(
      department,
      query,
    );
    return successRequestResponse(
      'Department team dashboard retrieved successfully',
      dashboard,
    );
  }

  @Get('managed/:reference/summary')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async managedSummary(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ) {
    await this.departmentService.findOneForManager(authUser.id, reference);
    const summary =
      await this.departmentService.getDepartmentDetailSummary(reference);
    return successRequestResponse(
      'Department summary fetched successfully',
      summary,
    );
  }

  @Get('managed/:reference/budget-summary')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async managedBudgetSummary(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: BudgetSummaryQueryDto,
  ) {
    const department = await this.departmentService.findOneForManager(
      authUser.id,
      reference,
    );
    const summary = await this.budgetService.getDepartmentSummary(
      department.id,
      query.year ?? new Date().getUTCFullYear(),
    );
    return successRequestResponse(
      'Department budget summary fetched',
      toBudgetSummaryResponse(summary),
    );
  }

  @Get('managed/:reference/budget-forecast')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async managedBudgetForecast(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: BudgetSummaryQueryDto,
  ) {
    const department = await this.departmentService.findOneForManager(
      authUser.id,
      reference,
    );
    const summary = await this.budgetService.getDepartmentSummary(
      department.id,
      query.year ?? new Date().getUTCFullYear(),
    );
    if (!summary.budget) {
      return successRequestResponse('No active budget found for forecast', {
        hasBudget: false,
      });
    }

    const forecast = this.budgetAlertService.getForecast(
      summary.amountLimit,
      summary.committedAmount,
      summary.year,
    );

    return successRequestResponse('Department budget forecast retrieved', {
      hasBudget: true,
      ...forecast,
    });
  }

  @Get('managed/:reference/manager-history')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async findManagedManagerHistory(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: ListDepartmentManagerHistoryQueryDto,
  ) {
    await this.departmentService.findOneForManager(authUser.id, reference);
    const result = await this.departmentService.findManagerHistory(
      reference,
      query,
    );
    return successRequestResponse(
      'Department manager history fetched successfully',
      result.data.map(toDepartmentManagerHistoryResponse),
      result.meta,
    );
  }

  @Get('managed/:reference/users')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async findManagedUsers(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: ListDepartmentUsersQueryDto,
  ) {
    await this.departmentService.findOneForManager(authUser.id, reference);
    const result = await this.departmentService.findDepartmentUsers(
      reference,
      query,
    );
    return successRequestResponse(
      'Department employees fetched successfully',
      result.data.map((user) => toUserResponse(user)),
      result.meta,
    );
  }

  @Get('managed/:reference')
  @RequireManagedDepartmentRead()
  @HttpCode(HttpStatus.OK)
  async findOneManaged(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ) {
    const department = await this.departmentService.findOneForManager(
      authUser.id,
      reference,
    );
    const pendingApprovalCount =
      await this.departmentService.countPendingApprovals(department.id);
    return successRequestResponse(
      'Department fetched successfully',
      toDepartmentResponse(department, { pendingApprovalCount }),
    );
  }

  @Get(':reference/budget-summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.BUDGET)
  async budgetSummary(
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: BudgetSummaryQueryDto,
  ) {
    const department = await this.departmentService.findOne(reference);
    const summary = await this.budgetService.getDepartmentSummary(
      department.id,
      query.year ?? new Date().getUTCFullYear(),
    );
    return successRequestResponse(
      'Department budget summary fetched',
      toBudgetSummaryResponse(summary),
    );
  }

  @Get(':reference/budget-forecast')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.BUDGET)
  async budgetForecast(
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: BudgetSummaryQueryDto,
  ) {
    const department = await this.departmentService.findOne(reference);
    const summary = await this.budgetService.getDepartmentSummary(
      department.id,
      query.year ?? new Date().getUTCFullYear(),
    );
    if (!summary.budget) {
      return successRequestResponse('No active budget found for forecast', {
        hasBudget: false,
      });
    }

    const forecast = this.budgetAlertService.getForecast(
      summary.amountLimit,
      summary.committedAmount,
      summary.year,
    );

    return successRequestResponse('Department budget forecast retrieved', {
      hasBudget: true,
      ...forecast,
    });
  }

  @Get(':reference/manager-history')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.DEPARTMENT)
  async findManagerHistory(
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: ListDepartmentManagerHistoryQueryDto,
  ) {
    const result = await this.departmentService.findManagerHistory(
      reference,
      query,
    );
    return successRequestResponse(
      'Department manager history fetched successfully',
      result.data.map(toDepartmentManagerHistoryResponse),
      result.meta,
    );
  }

  @Get(':reference/users')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.DEPARTMENT)
  async findUsers(
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: ListDepartmentUsersQueryDto,
  ) {
    const result = await this.departmentService.findDepartmentUsers(
      reference,
      query,
    );
    return successRequestResponse(
      'Department employees fetched successfully',
      result.data.map((user) => toUserResponse(user)),
      result.meta,
    );
  }

  @Get(':reference/team-dashboard')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.DEPARTMENT)
  async teamDashboard(
    @Param('reference', EntityReferencePipe) reference: string,
    @Query() query: PersonalExpenseAnalyticsQueryDto,
  ) {
    const department = await this.departmentService.findOne(reference);
    const dashboard = await this.dashboardService.getTeamDashboardForDepartment(
      department,
      query,
    );
    return successRequestResponse(
      'Department team dashboard retrieved successfully',
      dashboard,
    );
  }

  @Get(':reference/summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.DEPARTMENT)
  async getSummary(@Param('reference', EntityReferencePipe) reference: string) {
    const summary =
      await this.departmentService.getDepartmentDetailSummary(reference);
    return successRequestResponse(
      'Department summary fetched successfully',
      summary,
    );
  }

  @Get(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.DEPARTMENT)
  async findOne(@Param('reference', EntityReferencePipe) reference: string) {
    const department = await this.departmentService.findOne(reference);
    const pendingApprovalCount =
      await this.departmentService.countPendingApprovals(department.id);
    return successRequestResponse(
      'Department fetched successfully',
      toDepartmentResponse(department, { pendingApprovalCount }),
    );
  }

  @Patch(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.DEPARTMENT)
  async update(
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdateDepartmentDto,
    @AuthUser() authUser: IAuthUser,
  ) {
    const department = await this.departmentService.update(
      reference,
      payload,
      authUser.id,
    );
    const pendingApprovalCount =
      await this.departmentService.countPendingApprovals(department.id);
    return successRequestResponse(
      'Department updated successfully',
      toDepartmentResponse(department, { pendingApprovalCount }),
    );
  }

  @Delete(':reference')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.DEPARTMENT)
  async remove(@Param('reference', EntityReferencePipe) reference: string) {
    await this.departmentService.remove(reference);
  }
}
