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

function permission(
  action: PermissionAction,
  resource: PermissionResource,
  scope: PermissionScope = PermissionScope.GLOBAL,
): AuthUserPermission {
  return { action, resource, scope };
}

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

describe('ApprovalAccessPolicy', () => {
  const evaluator = {
    hasPermission: jest.fn(),
  };
  const policy = new ApprovalAccessPolicy(evaluator as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows global approvers on any submitted expense', () => {
    evaluator.hasPermission.mockReturnValue(true);
    const authUser = user({ permissions: [] });

    expect(policy.canDecideOnExpense(authUser, expense())).toBe(true);
  });

  it('allows department managers for expenses in their department', () => {
    evaluator.hasPermission.mockReturnValue(false);
    const authUser = user({ managedDepartmentIds: [5] });

    expect(
      policy.canDecideOnExpense(authUser, expense({ departmentId: 5 })),
    ).toBe(true);
  });

  it('denies department managers for other departments', () => {
    evaluator.hasPermission.mockReturnValue(false);
    const authUser = user({ managedDepartmentIds: [5] });

    expect(
      policy.canDecideOnExpense(authUser, expense({ departmentId: 9 })),
    ).toBe(false);
  });

  it('treats managedDepartmentIds as org-grant approval path', () => {
    evaluator.hasPermission.mockReturnValue(false);
    const authUser = user({
      managedDepartmentIds: [3],
      permissions: [
        permission(
          PermissionAction.READ,
          PermissionResource.EXPENSE,
          PermissionScope.SELF,
        ),
      ],
    });

    expect(policy.canDecideOnApproval(authUser)).toBe(true);
    expect(policy.hasGlobalApprovalPermission(authUser)).toBe(false);
  });
});
