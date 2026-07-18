import type { Expense } from 'src/database/entities/expense.entity';
import type { IAuthUser } from 'src/definition';
import { PermissionAction, PermissionResource } from '../constants/permissions';
import { permissionGrants } from '../matching/permission-grants';
import type { AuthUserPermission } from '../types/auth-user.types';
import type {
  AbilityRule,
  AppAction,
  AppSubject,
  ExpenseInstanceChecker,
} from '../types/ability.types';

export class AppAbility {
  constructor(
    public readonly rules: AbilityRule[],
    private readonly permissions: AuthUserPermission[] = [],
    private readonly authUser?: IAuthUser,
    private readonly expenseChecker?: ExpenseInstanceChecker,
  ) {}

  can(action: AppAction, subject: AppSubject): boolean;
  can(action: AppAction, expense: Expense): boolean;
  can(action: AppAction, subject: AppSubject | Expense): boolean {
    if (this.isExpenseInstance(subject)) {
      if (!this.authUser || !this.expenseChecker) {
        return false;
      }
      return this.expenseChecker(this.authUser, action, subject);
    }

    return this.canOnResource(action, subject);
  }

  private canOnResource(action: AppAction, subject: AppSubject): boolean {
    for (let i = this.rules.length - 1; i >= 0; i--) {
      const rule = this.rules[i];
      if (this.matchesRule(rule, action, subject)) {
        return !rule.inverted;
      }
    }

    return this.permissions.some((permission) =>
      permissionGrants(permission, action, subject),
    );
  }

  private isExpenseInstance(subject: AppSubject | Expense): subject is Expense {
    return typeof subject === 'object' && subject !== null;
  }

  /** Whether the user manages at least one department (org grant path). */
  managesAnyDepartment(): boolean {
    return (this.authUser?.managedDepartmentIds?.length ?? 0) > 0;
  }

  private matchesRule(
    rule: AbilityRule,
    action: AppAction,
    subject: AppSubject,
  ) {
    const actionMatches =
      rule.action === PermissionAction.MANAGE || rule.action === action;
    const subjectMatches =
      rule.subject === PermissionResource.ALL || rule.subject === subject;
    return actionMatches && subjectMatches;
  }
}
