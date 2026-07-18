import type { IAuthUser } from 'src/definition';
import type { AuthUserPermission } from '../types/auth-user.types';
import type {
  AbilityRule,
  AppAction,
  AppSubject,
  ExpenseInstanceChecker,
} from '../types/ability.types';
import { AppAbility } from './app-ability';

export class AbilityBuilder {
  private readonly abilityRules: AbilityRule[] = [];
  private permissions: AuthUserPermission[] = [];
  private authUser?: IAuthUser;
  private expenseChecker?: ExpenseInstanceChecker;

  can(action: AppAction, subject: AppSubject): void {
    this.abilityRules.push({ action, subject });
  }

  cannot(action: AppAction, subject: AppSubject): void {
    this.abilityRules.push({ action, subject, inverted: true });
  }

  withPermissions(permissions: AuthUserPermission[]): this {
    this.permissions = permissions;
    return this;
  }

  forUser(user: IAuthUser): this {
    this.authUser = user;
    return this;
  }

  withExpenseChecker(checker: ExpenseInstanceChecker): this {
    this.expenseChecker = checker;
    return this;
  }

  build(): AppAbility {
    return new AppAbility(
      [...this.abilityRules],
      [...this.permissions],
      this.authUser,
      this.expenseChecker,
    );
  }
}
