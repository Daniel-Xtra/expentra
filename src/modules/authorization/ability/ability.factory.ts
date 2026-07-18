import { Injectable } from '@nestjs/common';
import type { IAuthUser } from 'src/definition';
import { PermissionAction, PermissionResource } from '../constants/permissions';
import { isDepartmentManager } from '../org-grants/org-grant.resolver';
import { ApprovalAccessPolicy } from '../policies/approval-access.policy';
import { ExpenseAccessPolicy } from '../policies/expense-access.policy';
import type { AuthUserPermission } from '../types/auth-user.types';
import { AbilityBuilder } from './ability.builder';
import { AppAbility } from './app-ability';

@Injectable()
export class AbilityFactory {
  constructor(
    private readonly expenseAccess: ExpenseAccessPolicy,
    private readonly approvalAccess: ApprovalAccessPolicy,
  ) {}

  /** Builds route- and instance-aware ability from role permissions and org grants. */
  createForUser(user: IAuthUser): AppAbility {
    const builder = new AbilityBuilder()
      .forUser(user)
      .withExpenseChecker((authUser, action, expense) =>
        this.expenseAccess.canOnExpense(authUser, action, expense),
      );

    if (!user?.role) {
      return builder.build();
    }

    const permissions = user.permissions as AuthUserPermission[];
    builder.withPermissions(permissions);

    if (this.approvalAccess.isManagerApprover(user) || isDepartmentManager(user)) {
      builder.can(PermissionAction.APPROVE, PermissionResource.APPROVAL);
      builder.can(PermissionAction.REJECT, PermissionResource.APPROVAL);
    }

    return builder.build();
  }
}
