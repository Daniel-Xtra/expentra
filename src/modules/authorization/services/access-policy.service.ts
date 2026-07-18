import { ForbiddenException, Injectable } from '@nestjs/common';
import { Expense } from 'src/database/entities/expense.entity';
import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import { ApprovalAccessPolicy } from '../policies/approval-access.policy';
import { ExpenseAccessPolicy } from '../policies/expense-access.policy';
import type {
  ExpenseDraftMutation,
  ExpenseListVisibility,
} from '../types/policy.types';
import { PermissionEvaluatorService } from './permission-evaluator.service';

/**
 * Application authorization facade for domain services.
 * HTTP routes use AppAbility via AccessGuard; services call assert/can methods here.
 */
@Injectable()
export class AccessPolicyService {
  constructor(
    private readonly permissionEvaluator: PermissionEvaluatorService,
    private readonly expenseAccess: ExpenseAccessPolicy,
    private readonly approvalAccess: ApprovalAccessPolicy,
  ) {}

  canManageAll(authUser: IAuthUser): boolean {
    return this.permissionEvaluator.canManageAll(authUser);
  }

  hasPermission(
    authUser: IAuthUser,
    action: PermissionAction,
    resource: PermissionResource,
    scope?: PermissionScope,
  ): boolean {
    return this.permissionEvaluator.hasPermission(
      authUser,
      action,
      resource,
      scope,
    );
  }

  canDecideOnApproval(authUser: IAuthUser): boolean {
    return this.approvalAccess.canDecideOnApproval(authUser);
  }

  canDecideOnExpense(authUser: IAuthUser, expense: Expense): boolean {
    return this.approvalAccess.canDecideOnExpense(authUser, expense);
  }

  canActOnApprovalStage(
    authUser: IAuthUser,
    expense: Expense,
    stage: ApprovalLevel,
  ): boolean {
    return this.approvalAccess.canActOnApprovalStage(authUser, expense, stage);
  }

  hasGlobalApprovalPermission(authUser: IAuthUser): boolean {
    return this.approvalAccess.hasGlobalApprovalPermission(authUser);
  }

  isManagerApprover(authUser: IAuthUser): boolean {
    return this.approvalAccess.isManagerApprover(authUser);
  }

  expenseListVisibility(authUser: IAuthUser): ExpenseListVisibility {
    return this.expenseAccess.expenseListVisibility(authUser);
  }

  canReadExpense(authUser: IAuthUser, expense: Expense): boolean {
    return this.expenseAccess.canReadExpense(authUser, expense);
  }

  canOnExpense(
    authUser: IAuthUser,
    action: PermissionAction,
    expense: Expense,
  ): boolean {
    return this.expenseAccess.canOnExpense(authUser, action, expense);
  }

  canMutateExpenseDraft(
    authUser: IAuthUser,
    expense: Expense,
    action: ExpenseDraftMutation,
    options?: { ownerOnly?: boolean },
  ): boolean {
    return this.expenseAccess.canMutateExpenseDraft(
      authUser,
      expense,
      action,
      options,
    );
  }

  canManageReceiptOnExpense(authUser: IAuthUser, expense: Expense): boolean {
    return this.expenseAccess.canManageReceiptOnExpense(authUser, expense);
  }

  assertCanMutateExpenseDraft(
    authUser: IAuthUser,
    expense: Expense,
    action: ExpenseDraftMutation,
    options?: { ownerOnly?: boolean },
  ): void {
    if (this.canMutateExpenseDraft(authUser, expense, action, options)) {
      return;
    }

    if (options?.ownerOnly) {
      throw new ForbiddenException('You can only submit your own expenses');
    }

    const verb =
      action === 'delete'
        ? 'delete'
        : action === 'submit'
          ? 'submit'
          : 'modify';
    throw new ForbiddenException(`You can only ${verb} your own expenses`);
  }

  assertCanManageReceiptOnExpense(authUser: IAuthUser, expense: Expense): void {
    if (!this.canManageReceiptOnExpense(authUser, expense)) {
      throw new ForbiddenException(
        'You can only manage receipts on your own draft expenses',
      );
    }
  }

  assertCanReimburseExpense(authUser: IAuthUser): void {
    if (
      !this.hasPermission(
        authUser,
        PermissionAction.REIMBURSE,
        PermissionResource.EXPENSE,
      )
    ) {
      throw new ForbiddenException(
        'You do not have permission to mark expenses as reimbursed',
      );
    }
  }

  assertCanListPersonalExpenses(authUser: IAuthUser): void {
    if (
      this.hasPermission(
        authUser,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.SELF,
      ) ||
      this.hasPermission(
        authUser,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.GLOBAL,
      ) ||
      this.canManageAll(authUser)
    ) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to list your expenses',
    );
  }

  assertCanListAllExpenses(authUser: IAuthUser): void {
    if (
      this.hasPermission(
        authUser,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.GLOBAL,
      ) ||
      this.canManageAll(authUser)
    ) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to list all expenses',
    );
  }

  assertCanListForApprovalExpenses(authUser: IAuthUser): void {
    if (this.canDecideOnApproval(authUser)) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to list expenses pending approval',
    );
  }

  assertCanReadExpense(authUser: IAuthUser, expense: Expense): void {
    if (!this.canReadExpense(authUser, expense)) {
      throw new ForbiddenException('You do not have access to this expense');
    }
  }

  assertCanDecideOnExpense(authUser: IAuthUser, expense: Expense): void {
    if (expense.userId === authUser.id) {
      throw new ForbiddenException(
        'You cannot approve or reject your own expense',
      );
    }

    if (!this.canDecideOnExpense(authUser, expense)) {
      throw new ForbiddenException(
        'You do not have permission to approve or reject this expense',
      );
    }
  }
}
