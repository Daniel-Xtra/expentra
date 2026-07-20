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
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
  RequireAnyPermissionByName,
} from 'src/modules/authorization';
import { IResponse, successRequestResponse } from 'src/core/utils/helper';
import { CreateExpenseDto } from '../dtos/create-expense.dto';
import { ListExpensesQueryDto } from '../dtos/list-expenses.query.dto';
import { UpdateExpenseDto } from '../dtos/update-expense.dto';
import {
  toExpenseResponse,
  toReimbursementResponse,
} from '../mappers/expense-response.mapper';
import {
  EXPENSE_SERVICE,
  type IExpenseService,
} from '../contracts/expense.contract';
import { BulkReimburseExpensesDto } from '../dtos/bulk-reimburse-expenses.dto';
import { CheckExpenseDuplicateDto } from '../dtos/check-expense-duplicate.dto';
import { CreateExpenseCommentDto } from '../dtos/create-expense-comment.dto';
import { ExpensePolicyHintsQueryDto } from '../dtos/expense-policy-hints.query.dto';
import { toExpenseSubmitCheckResponse } from '../mappers/expense-submit-check-response.mapper';
import { SubmitExpenseDto } from '../dtos/submit-expense.dto';
import {
  toExpenseActivityResponse,
  toExpenseCommentResponse,
  toExpensePolicyExceptionResponse,
} from '../mappers/expense-comment-response.mapper';
import { Idempotent } from 'src/core/idempotency/idempotency.decorator';
import { ExportService } from 'src/modules/export/services/export.service';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { exportQueuedResponse } from 'src/modules/export/utils/export-response.util';
import { ExpenseCommentService } from '../services/expense-comment.service';

@Controller({ path: 'expenses', version: '1' })
export class ExpenseController {
  constructor(
    @Inject(EXPENSE_SERVICE) private readonly expenseService: IExpenseService,
    private readonly expenseCommentService: ExpenseCommentService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.EXPENSE)
  async create(
    @AuthUser() user: IAuthUser,
    @Body() payload: CreateExpenseDto,
  ): Promise<IResponse> {
    const expense = await this.expenseService.create(user.id, payload);
    return successRequestResponse(
      'Expense draft created',
      toExpenseResponse(expense),
    );
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async findPersonal(
    @AuthUser() user: IAuthUser,
    @Query() query: ListExpensesQueryDto,
  ): Promise<IResponse> {
    const result = await this.expenseService.findPersonalExpenses(user, query);
    return successRequestResponse(
      'Personal expenses fetched successfully',
      result.data.map((e) => toExpenseResponse(e)),
      result.meta,
    );
  }

  @Get('me/status-counts')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async getPersonalStatusCounts(
    @AuthUser() user: IAuthUser,
  ): Promise<IResponse> {
    const counts =
      await this.expenseService.getPersonalExpenseStatusCounts(user);
    return successRequestResponse(
      'Personal expense status counts fetched successfully',
      counts,
    );
  }

  @Post('me/export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async exportPersonalCsv(
    @AuthUser() user: IAuthUser,
    @Query() query: ListExpensesQueryDto,
  ): Promise<IResponse> {
    const result = await this.exportService.queueExport({
      authUser: user,
      jobType: ExportJobType.EXPENSE_PERSONAL_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }

  @Get('')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async findAll(
    @AuthUser() user: IAuthUser,
    @Query() query: ListExpensesQueryDto,
  ): Promise<IResponse> {
    const result = await this.expenseService.findAllExpenses(user, query);
    return successRequestResponse(
      'All expenses fetched successfully',
      result.data.map((e) =>
        toExpenseResponse(e, { includePrimaryReceipt: true }),
      ),
      result.meta,
    );
  }

  @Get('status-counts')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async getAllStatusCounts(@AuthUser() user: IAuthUser): Promise<IResponse> {
    const counts = await this.expenseService.getAllExpenseStatusCounts(user);
    return successRequestResponse(
      'Expense status counts fetched successfully',
      counts,
    );
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async exportAllCsv(
    @AuthUser() user: IAuthUser,
    @Query() query: ListExpensesQueryDto,
  ): Promise<IResponse> {
    const result = await this.exportService.queueExport({
      authUser: user,
      jobType: ExportJobType.EXPENSE_ALL_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }

  @Get('policy-hints')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.EXPENSE)
  async getPolicyHints(
    @AuthUser() user: IAuthUser,
    @Query() query: ExpensePolicyHintsQueryDto,
  ): Promise<IResponse> {
    const hints = await this.expenseService.getPolicyHints(
      user,
      query.category,
    );
    return successRequestResponse(
      'Expense policy hints fetched successfully',
      hints,
    );
  }

  @Post('check-duplicate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.EXPENSE)
  async checkDuplicate(
    @AuthUser() user: IAuthUser,
    @Body() payload: CheckExpenseDuplicateDto,
  ): Promise<IResponse> {
    const result = await this.expenseService.checkDuplicateExpense(
      user,
      payload,
    );
    return successRequestResponse('Duplicate expense check completed', result);
  }

  @Get('finance-queue/summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.REIMBURSE, PermissionResource.EXPENSE)
  async getFinanceQueueSummary(
    @AuthUser() user: IAuthUser,
  ): Promise<IResponse> {
    const summary = await this.expenseService.getFinanceQueueSummary(user);
    return successRequestResponse(
      'Finance queue summary fetched successfully',
      summary,
    );
  }

  @Post('approved/payroll-export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.REIMBURSE, PermissionResource.EXPENSE)
  async exportPayrollCsv(@AuthUser() user: IAuthUser): Promise<IResponse> {
    const result = await this.exportService.queueExport({
      authUser: user,
      jobType: ExportJobType.EXPENSE_PAYROLL_XLSX,
    });
    return exportQueuedResponse(result);
  }

  @Post('reimburse/bulk')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(PermissionAction.REIMBURSE, PermissionResource.EXPENSE)
  async bulkReimburse(
    @AuthUser() user: IAuthUser,
    @Body() payload: BulkReimburseExpensesDto,
  ): Promise<IResponse> {
    const result = await this.expenseService.bulkReimburse(
      user,
      payload.references,
    );
    const message = result.allSucceeded
      ? 'Bulk reimbursement completed'
      : result.partialSuccess
        ? 'Bulk reimbursement partially completed'
        : 'Bulk reimbursement failed';
    return successRequestResponse(message, result);
  }

  @Get('pending-approval/summary')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissionByName('approval.approve', 'approval.reject')
  async getPendingApprovalSummary(
    @AuthUser() user: IAuthUser,
  ): Promise<IResponse> {
    const summary = await this.expenseService.getPendingApprovalSummary(user);
    return successRequestResponse(
      'Pending approval summary fetched successfully',
      summary,
    );
  }

  @Get('pending-approval')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissionByName('approval.approve', 'approval.reject')
  async findForApproval(
    @AuthUser() user: IAuthUser,
    @Query() query: ListExpensesQueryDto,
  ): Promise<IResponse> {
    const result = await this.expenseService.findForApprovalExpenses(
      user,
      query,
    );
    const budgetFlags = await this.expenseService.resolveApprovalBudgetFlags(
      result.data,
    );
    return successRequestResponse(
      'Expenses pending approval fetched successfully',
      result.data.map((expense) => {
        const flags = budgetFlags.get(expense.id);
        return toExpenseResponse(expense, {
          includePrimaryReceipt: true,
          budgetWouldExceed: flags?.budgetWouldExceed ?? false,
          requiresOverBudgetAcknowledgment:
            flags?.requiresOverBudgetAcknowledgment ?? false,
        });
      }),
      result.meta,
    );
  }

  @Get(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async findOne(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const expense = await this.expenseService.findOne(user, reference);
    const [canActOnApproval, approvalChain, budgetFlags] = await Promise.all([
      this.expenseService.canActOnApproval(user, expense),
      this.expenseService.buildApprovalChain(expense),
      this.expenseService.resolveApprovalBudgetFlagsForExpense(expense),
    ]);
    return successRequestResponse(
      'Expense fetched successfully',
      toExpenseResponse(expense, {
        includeRelations: true,
        canActOnApproval,
        approvalChain,
        budgetWouldExceed: budgetFlags.budgetWouldExceed,
        requiresOverBudgetAcknowledgment:
          budgetFlags.requiresOverBudgetAcknowledgment,
      }),
    );
  }

  @Patch(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.EXPENSE)
  async update(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdateExpenseDto,
  ): Promise<IResponse> {
    const expense = await this.expenseService.update(user, reference, payload);
    return successRequestResponse(
      'Expense updated successfully',
      toExpenseResponse(expense),
    );
  }

  @Get(':reference/comments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async listComments(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const comments = await this.expenseCommentService.listComments(
      user,
      reference,
    );
    return successRequestResponse(
      'Expense comments retrieved successfully',
      comments.map(toExpenseCommentResponse),
    );
  }

  @Post(':reference/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.EXPENSE)
  async addComment(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: CreateExpenseCommentDto,
  ): Promise<IResponse> {
    const comment = await this.expenseCommentService.addComment(
      user,
      reference,
      payload.body,
    );
    return successRequestResponse(
      'Expense comment added successfully',
      toExpenseCommentResponse(comment),
    );
  }

  @Get(':reference/policy-exceptions')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async listPolicyExceptions(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const exceptions = await this.expenseCommentService.listPolicyExceptions(
      user,
      reference,
    );
    return successRequestResponse(
      'Expense policy exceptions retrieved successfully',
      exceptions.map(toExpensePolicyExceptionResponse),
    );
  }

  @Get(':reference/activity')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.EXPENSE)
  async getActivity(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const activity = await this.expenseCommentService.getActivityTimeline(
      user,
      reference,
    );
    return successRequestResponse(
      'Expense activity timeline retrieved successfully',
      activity.map(toExpenseActivityResponse),
    );
  }

  @Post(':reference/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.EXPENSE)
  async reopenRejected(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const expense = await this.expenseService.reopenRejected(user, reference);
    return successRequestResponse(
      'Rejected expense reopened as draft',
      toExpenseResponse(expense),
    );
  }

  @Post(':reference/submit/check')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.SUBMIT, PermissionResource.EXPENSE)
  async checkSubmitPolicies(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const result = await this.expenseService.checkSubmitPolicies(
      user,
      reference,
    );
    return successRequestResponse(
      'Expense submit check completed',
      toExpenseSubmitCheckResponse(result),
    );
  }

  @Post(':reference/submit')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(PermissionAction.SUBMIT, PermissionResource.EXPENSE)
  async submit(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload?: SubmitExpenseDto,
  ): Promise<IResponse> {
    const expense = await this.expenseService.submit(user, reference, {
      policyJustifications: payload?.policyJustifications,
    });
    return successRequestResponse(
      'Expense submitted for approval',
      toExpenseResponse(expense),
    );
  }

  @Post(':reference/reimburse')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(PermissionAction.REIMBURSE, PermissionResource.EXPENSE)
  async reimburse(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const expense = await this.expenseService.reimburse(user, reference);
    return successRequestResponse(
      'Expense marked as reimbursed',
      toReimbursementResponse(expense),
    );
  }

  @Delete(':reference')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.EXPENSE)
  async remove(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<void> {
    await this.expenseService.remove(user, reference);
  }
}
