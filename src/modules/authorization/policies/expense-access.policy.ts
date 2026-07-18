import { Injectable } from '@nestjs/common';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import { canAccessScopedSubject } from '../matching/scope-access';
import { PermissionEvaluatorService } from '../services/permission-evaluator.service';
import type {
  ExpenseDraftMutation,
  ExpenseListVisibility,
} from '../types/policy.types';
import { ApprovalAccessPolicy } from './approval-access.policy';

@Injectable()
export class ExpenseAccessPolicy {
  constructor(
    private readonly permissionEvaluator: PermissionEvaluatorService,
    private readonly approvalAccess: ApprovalAccessPolicy,
  ) {}

  expenseListVisibility(authUser: IAuthUser): ExpenseListVisibility {
    if (
      this.permissionEvaluator.hasPermission(
        authUser,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.GLOBAL,
      )
    ) {
      return 'all';
    }

    if (this.approvalAccess.canDecideOnApproval(authUser)) {
      return 'own-and-submitted';
    }

    if (
      this.permissionEvaluator.hasPermission(
        authUser,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.SELF,
      )
    ) {
      return 'own';
    }

    return 'own';
  }

  canReadExpense(authUser: IAuthUser, expense: Expense): boolean {
    // Drafts are private to the submitter until submitted.
    if (expense.status === ExpenseStatus.DRAFT) {
      if (expense.userId !== authUser.id) {
        return false;
      }

      return (
        this.permissionEvaluator.hasPermission(
          authUser,
          PermissionAction.READ,
          PermissionResource.EXPENSE,
          PermissionScope.SELF,
        ) ||
        this.permissionEvaluator.hasPermission(
          authUser,
          PermissionAction.READ,
          PermissionResource.EXPENSE,
          PermissionScope.GLOBAL,
        ) ||
        this.permissionEvaluator.canManageAll(authUser)
      );
    }

    if (
      this.permissionEvaluator.hasPermission(
        authUser,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.GLOBAL,
      )
    ) {
      return true;
    }

    if (expense.userId === authUser.id) {
      return this.permissionEvaluator.hasPermission(
        authUser,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.SELF,
      );
    }

    if (
      (expense.status === ExpenseStatus.SUBMITTED ||
        expense.status === ExpenseStatus.UNDER_REVIEW) &&
      this.approvalAccess.canDecideOnExpense(authUser, expense)
    ) {
      return true;
    }

    if (
      expense.status === ExpenseStatus.UNDER_REVIEW &&
      this.permissionEvaluator.hasPermission(
        authUser,
        PermissionAction.REIMBURSE,
        PermissionResource.EXPENSE,
        PermissionScope.GLOBAL,
      )
    ) {
      return true;
    }

    return false;
  }

  canOnExpense(
    authUser: IAuthUser,
    action: PermissionAction,
    expense: Expense,
  ): boolean {
    switch (action) {
      case PermissionAction.READ:
        return this.canReadExpense(authUser, expense);
      case PermissionAction.UPDATE:
        return this.canMutateExpenseDraft(authUser, expense, 'modify');
      case PermissionAction.DELETE:
        return this.canMutateExpenseDraft(authUser, expense, 'delete');
      case PermissionAction.SUBMIT:
        return this.canMutateExpenseDraft(authUser, expense, 'submit', {
          ownerOnly: true,
        });
      case PermissionAction.APPROVE:
      case PermissionAction.REJECT:
        return this.approvalAccess.canDecideOnExpense(authUser, expense);
      case PermissionAction.REIMBURSE:
        return this.permissionEvaluator.hasPermission(
          authUser,
          PermissionAction.REIMBURSE,
          PermissionResource.EXPENSE,
        );
      default:
        return this.permissionEvaluator.hasPermission(
          authUser,
          action,
          PermissionResource.EXPENSE,
        );
    }
  }

  canMutateExpenseDraft(
    authUser: IAuthUser,
    expense: Expense,
    action: ExpenseDraftMutation,
    options?: { ownerOnly?: boolean },
  ): boolean {
    if (options?.ownerOnly) {
      return expense.userId === authUser.id;
    }

    const permissionAction =
      action === 'delete'
        ? PermissionAction.DELETE
        : action === 'submit'
          ? PermissionAction.SUBMIT
          : PermissionAction.UPDATE;

    return canAccessScopedSubject(
      authUser,
      { userId: expense.userId },
      (scope) =>
        this.permissionEvaluator.hasPermission(
          authUser,
          permissionAction,
          PermissionResource.EXPENSE,
          scope,
        ),
      { manageAll: this.permissionEvaluator.canManageAll(authUser) },
    );
  }

  canManageReceiptOnExpense(authUser: IAuthUser, expense: Expense): boolean {
    if (expense.userId === authUser.id) {
      return true;
    }

    return this.permissionEvaluator.canManageAll(authUser);
  }
}
