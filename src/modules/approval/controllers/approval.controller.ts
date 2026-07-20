import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { Idempotent } from 'src/core/idempotency/idempotency.decorator';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { successRequestResponse } from 'src/core/utils/helper';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import { toApprovalResponse } from 'src/modules/expense/mappers/expense-response.mapper';
import {
  APPROVAL_SERVICE,
  type IApprovalService,
} from '../contracts/approval.contract';
import { ApproveExpenseDto } from '../dtos/approve-expense.dto';
import { BulkApproveExpensesDto } from '../dtos/bulk-approve-expenses.dto';
import { BulkRejectExpensesDto } from '../dtos/bulk-reject-expenses.dto';
import { RejectExpenseDto } from '../dtos/reject-expense.dto';

@Controller({ path: 'approvals', version: '1' })
export class ApprovalController {
  constructor(
    @Inject(APPROVAL_SERVICE)
    private readonly approvalService: IApprovalService,
  ) {}

  @Post('bulk-approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(PermissionAction.APPROVE, PermissionResource.APPROVAL)
  async bulkApprove(
    @AuthUser() user: IAuthUser,
    @Body() payload: BulkApproveExpensesDto,
  ) {
    const result = await this.approvalService.bulkApproveByReference(
      user,
      payload.references,
      {
        comment: payload.comment,
        overBudgetAcknowledged: payload.overBudgetAcknowledged,
      },
    );
    return successRequestResponse('Bulk approval completed', result);
  }

  @Post('bulk-reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(PermissionAction.REJECT, PermissionResource.APPROVAL)
  async bulkReject(
    @AuthUser() user: IAuthUser,
    @Body() payload: BulkRejectExpensesDto,
  ) {
    const result = await this.approvalService.bulkRejectByReference(
      user,
      payload.references,
      { comment: payload.comment },
    );
    return successRequestResponse('Bulk rejection completed', result);
  }

  @Post(':expenseReference/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(PermissionAction.APPROVE, PermissionResource.APPROVAL)
  async approve(
    @AuthUser() user: IAuthUser,
    @Param('expenseReference', EntityReferencePipe)
    expenseReference: string,
    @Body() payload: ApproveExpenseDto,
  ) {
    const approval = await this.approvalService.approveByReference(
      user,
      expenseReference,
      payload,
    );
    return successRequestResponse(
      'Expense approved successfully',
      toApprovalResponse(approval),
    );
  }

  @Post(':expenseReference/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(PermissionAction.REJECT, PermissionResource.APPROVAL)
  async reject(
    @AuthUser() user: IAuthUser,
    @Param('expenseReference', EntityReferencePipe)
    expenseReference: string,
    @Body() payload: RejectExpenseDto,
  ) {
    const approval = await this.approvalService.rejectByReference(
      user,
      expenseReference,
      payload,
    );
    return successRequestResponse(
      'Expense rejected successfully',
      toApprovalResponse(approval),
    );
  }
}
