import { Injectable } from '@nestjs/common';
import { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import { Expense } from 'src/database/entities/expense.entity';
import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import { PermissionEvaluatorService } from '../services/permission-evaluator.service';

@Injectable()
export class ApprovalAccessPolicy {
  constructor(
    private readonly permissionEvaluator: PermissionEvaluatorService,
  ) {}

  canDecideOnApproval(authUser: IAuthUser): boolean {
    return (
      this.hasGlobalApprovalPermission(authUser) ||
      this.isManagerApprover(authUser)
    );
  }

  canDecideOnExpense(authUser: IAuthUser, expense: Expense): boolean {
    if (this.hasGlobalApprovalPermission(authUser)) {
      return true;
    }

    if (!this.isManagerApprover(authUser)) {
      return false;
    }

    const expenseDepartmentId = this.resolveExpenseDepartmentId(expense);
    if (!expenseDepartmentId) {
      return false;
    }

    return authUser.managedDepartmentIds.includes(expenseDepartmentId);
  }

  canActOnApprovalStage(
    authUser: IAuthUser,
    expense: Expense,
    stage: ApprovalLevel,
  ): boolean {
    if (!this.canDecideOnExpense(authUser, expense)) {
      return false;
    }

    switch (stage.approverType) {
      case ApprovalApproverType.DEPARTMENT_MANAGER:
        return this.isDepartmentManagerForExpense(authUser, expense);
      case ApprovalApproverType.FINANCE_MANAGER:
        return this.hasGlobalApprovalPermission(authUser);
      default: {
        const stageRoleId = stage.role?.id;
        return !!stageRoleId && authUser.roleId === stageRoleId;
      }
    }
  }

  hasGlobalApprovalPermission(authUser: IAuthUser): boolean {
    return (
      this.permissionEvaluator.hasPermission(
        authUser,
        PermissionAction.APPROVE,
        PermissionResource.APPROVAL,
        PermissionScope.GLOBAL,
      ) ||
      this.permissionEvaluator.hasPermission(
        authUser,
        PermissionAction.REJECT,
        PermissionResource.APPROVAL,
        PermissionScope.GLOBAL,
      )
    );
  }

  isManagerApprover(authUser: IAuthUser): boolean {
    return authUser.managedDepartmentIds.length > 0;
  }

  isDepartmentManagerForExpense(
    authUser: IAuthUser,
    expense: Expense,
  ): boolean {
    const expenseDepartmentId = this.resolveExpenseDepartmentId(expense);
    if (!expenseDepartmentId) {
      return false;
    }

    return authUser.managedDepartmentIds.includes(expenseDepartmentId);
  }

  private resolveExpenseDepartmentId(expense: Expense): number | null {
    return expense.departmentId ?? expense.user?.departmentId ?? null;
  }
}
