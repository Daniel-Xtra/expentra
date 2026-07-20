import { ForbiddenException } from '@nestjs/common';
import { SYSTEM_ROLES } from '../../../database/constants/system-roles';
import { Permission } from '../../../database/entities/permission.entity';
import type { IAuthUser } from '../../../definition';
import { assertNoSeparationOfDutiesConflicts } from '../policies/separation-of-duties.rules';
import { PermissionAssignmentPolicy } from './permission-assignment.policy';
import { PermissionEvaluatorService } from './permission-evaluator.service';

function permission(name: string): Permission {
  return Object.assign(new Permission(), { name });
}

function actor(permissions: Permission[]): IAuthUser {
  return {
    id: 1,
    reference: 'usr_actor',
    email: 'actor@example.com',
    role: 'hr_admin',
    roleId: 2,
    isActive: true,
    isEmailVerified: true,
    managedDepartmentIds: [],
    permissions: permissions.map((item) => ({
      name: item.name,
      action: item.action,
      resource: item.resource,
      scope: item.scope,
    })),
  };
}

describe('PermissionAssignmentPolicy', () => {
  const evaluator = {
    hasPermission: jest.fn().mockReturnValue(true),
  } as unknown as PermissionEvaluatorService;

  const policy = new PermissionAssignmentPolicy(evaluator);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks assigning permissions the actor does not hold', () => {
    (evaluator.hasPermission as jest.Mock).mockReturnValueOnce(false);

    expect(() =>
      policy.assertCanAssignPermissions(actor([]), [permission('user.update')]),
    ).toThrow(ForbiddenException);
  });

  it('blocks separation-of-duties conflicts for non-super-admin', () => {
    expect(() =>
      policy.assertCanAssignPermissions(actor([]), [
        permission('expense.submit'),
        permission('approval.approve'),
      ]),
    ).toThrow(/separation of duties/i);
  });

  it('allows super admin to assign permissions they do not personally hold', () => {
    const superAdmin = {
      ...actor([]),
      role: SYSTEM_ROLES.SUPER_ADMIN,
    };

    expect(() =>
      policy.assertCanAssignPermissions(superAdmin, [
        permission('user.update'),
      ]),
    ).not.toThrow();
  });

  it('still blocks separation-of-duties conflicts for super admin', () => {
    const superAdmin = {
      ...actor([]),
      role: SYSTEM_ROLES.SUPER_ADMIN,
    };

    expect(() =>
      policy.assertCanAssignPermissions(superAdmin, [
        permission('expense.submit'),
        permission('approval.approve'),
      ]),
    ).toThrow(/separation of duties/i);
  });
});
