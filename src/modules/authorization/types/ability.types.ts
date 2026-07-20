import type { Expense } from 'src/database/entities/expense.entity';
import type { IAuthUser } from 'src/definition';
import type {
  PermissionAction,
  PermissionResource,
} from '../constants/permissions';

export type AppAction = PermissionAction;
export type AppSubject = PermissionResource;

export type AbilityRule = {
  action: AppAction;
  subject: AppSubject;
  inverted?: boolean;
};

export type ExpenseInstanceChecker = (
  authUser: IAuthUser,
  action: PermissionAction,
  expense: Expense,
) => boolean;
