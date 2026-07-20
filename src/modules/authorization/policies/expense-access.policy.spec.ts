import { Expense } from '../../../database/entities/expense.entity';
import { ExpenseStatus } from '../../../database/entities/expense.enums';
import type { IAuthUser } from '../../../definition';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import type { AuthUserPermission } from '../types/auth-user.types';
import { ApprovalAccessPolicy } from './approval-access.policy';
import { ExpenseAccessPolicy } from './expense-access.policy';

function user(
  overrides: Partial<IAuthUser> & { permissions?: AuthUserPermission[] },
): IAuthUser {
  return {
    id: 1,
    reference: 'usr_test',
    email: 'test@example.com',
    role: 'staff',
    roleId: 1,
    isActive: true,
    isEmailVerified: true,
    managedDepartmentIds: [],
    permissions: [],
    ...overrides,
  };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return Object.assign(new Expense(), {
    id: 1,
    userId: 2,
    departmentId: 5,
    status: ExpenseStatus.SUBMITTED,
    ...overrides,
  });
}

describe('ExpenseAccessPolicy', () => {
  const evaluator = {
    hasPermission: jest.fn(),
    canManageAll: jest.fn().mockReturnValue(false),
  };
  const approvalAccess = new ApprovalAccessPolicy(evaluator as never);
  const policy = new ExpenseAccessPolicy(evaluator as never, approvalAccess);

  beforeEach(() => {
    jest.resetAllMocks();
    evaluator.canManageAll.mockReturnValue(false);
  });

  it('returns all visibility for global expense readers', () => {
    evaluator.hasPermission.mockImplementation(
      (_authUser, action, resource, scope) =>
        action === PermissionAction.READ &&
        resource === PermissionResource.EXPENSE &&
        scope === PermissionScope.GLOBAL,
    );

    expect(policy.expenseListVisibility(user({}))).toBe('all');
  });

  it('returns own-and-submitted for department managers without global read', () => {
    evaluator.hasPermission.mockReturnValue(false);
    const authUser = user({ managedDepartmentIds: [5] });

    expect(policy.expenseListVisibility(authUser)).toBe('own-and-submitted');
  });

  it('allows managers to read submitted expenses in managed departments', () => {
    evaluator.hasPermission.mockReturnValue(false);
    const authUser = user({ managedDepartmentIds: [5] });

    expect(
      policy.canReadExpense(authUser, expense({ departmentId: 5 })),
    ).toBe(true);
  });

  it('allows owners to read own expenses with self read permission', () => {
    evaluator.hasPermission.mockImplementation(
      (_authUser, action, resource, scope) =>
        action === PermissionAction.READ &&
        resource === PermissionResource.EXPENSE &&
        scope === PermissionScope.SELF,
    );
    const authUser = user({ id: 2 });

    expect(
      policy.canReadExpense(authUser, expense({ userId: 2, departmentId: 1 })),
    ).toBe(true);
  });

  it('denies global readers access to another users draft', () => {
    evaluator.hasPermission.mockImplementation(
      (_authUser, action, resource, scope) =>
        action === PermissionAction.READ &&
        resource === PermissionResource.EXPENSE &&
        scope === PermissionScope.GLOBAL,
    );

    expect(
      policy.canReadExpense(
        user({ id: 1 }),
        expense({ userId: 2, status: ExpenseStatus.DRAFT }),
      ),
    ).toBe(false);
  });

  it('allows owners to read their own draft with self read', () => {
    evaluator.hasPermission.mockImplementation(
      (_authUser, action, resource, scope) =>
        action === PermissionAction.READ &&
        resource === PermissionResource.EXPENSE &&
        scope === PermissionScope.SELF,
    );

    expect(
      policy.canReadExpense(
        user({ id: 2 }),
        expense({ userId: 2, status: ExpenseStatus.DRAFT }),
      ),
    ).toBe(true);
  });

  it('allows owners to read their own draft with global read', () => {
    evaluator.hasPermission.mockImplementation(
      (_authUser, action, resource, scope) =>
        action === PermissionAction.READ &&
        resource === PermissionResource.EXPENSE &&
        scope === PermissionScope.GLOBAL,
    );

    expect(
      policy.canReadExpense(
        user({ id: 2 }),
        expense({ userId: 2, status: ExpenseStatus.DRAFT }),
      ),
    ).toBe(true);
  });
});
