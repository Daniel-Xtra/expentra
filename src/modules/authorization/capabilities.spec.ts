import type { IAuthUser } from 'src/definition';
import { capabilitiesFromAuthContext } from './capabilities';
import { OrgGrantType } from './org-grants/org-grant.types';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from './constants/permissions';

function staffUser(): IAuthUser {
  return {
    id: 1,
    reference: 'usr_test',
    email: 'staff@example.com',
    role: 'staff',
    roleId: 2,
    isActive: true,
    isEmailVerified: true,
    departmentId: 1,
    managedDepartmentIds: [],
    permissions: [
      {
        action: PermissionAction.READ,
        resource: PermissionResource.EXPENSE,
        scope: PermissionScope.SELF,
      },
    ],
  };
}

describe('capabilitiesFromAuthContext', () => {
  it('returns wildcard for super admin', () => {
    const caps = capabilitiesFromAuthContext({
      ...staffUser(),
      role: 'super_admin',
    });
    expect(caps).toEqual(['*']);
  });

  it('merges org grant capabilities for super admin department managers', () => {
    const caps = capabilitiesFromAuthContext(
      { ...staffUser(), role: 'super_admin', managedDepartmentIds: [10] },
      [{ type: OrgGrantType.DEPARTMENT_MANAGER, label: 'Engineering' }],
    );

    expect(caps).toContain('*');
    expect(caps).toContain('department:read:managed');
    expect(caps).toContain('dashboard:read:team');
  });

  it('projects department manager org grant capabilities', () => {
    const caps = capabilitiesFromAuthContext(
      { ...staffUser(), managedDepartmentIds: [10] },
      [{ type: OrgGrantType.DEPARTMENT_MANAGER, label: 'Engineering' }],
    );

    expect(caps).toContain('approval:approve');
    expect(caps).toContain('approval:read');
    expect(caps).toContain('department:read:managed');
    expect(caps).toContain('dashboard:read:team');
  });

  it('includes user:read when permission is present', () => {
    const caps = capabilitiesFromAuthContext({
      ...staffUser(),
      permissions: [
        {
          action: PermissionAction.READ,
          resource: PermissionResource.USER,
          scope: PermissionScope.GLOBAL,
        },
      ],
    });

    expect(caps).toContain('user:read');
    expect(caps).not.toContain('user:create');
  });

  it('projects approval-level permissions separately from approval decisions', () => {
    const caps = capabilitiesFromAuthContext({
      ...staffUser(),
      permissions: [
        {
          action: PermissionAction.READ,
          resource: PermissionResource.APPROVAL_LEVEL,
          scope: PermissionScope.GLOBAL,
        },
      ],
    });

    expect(caps).toContain('approval_level:read');
    expect(caps).not.toContain('approval:read');
  });

  it('maps budget.read.own to budget:read:own without admin budget:read', () => {
    const caps = capabilitiesFromAuthContext({
      ...staffUser(),
      permissions: [
        {
          action: PermissionAction.READ,
          resource: PermissionResource.BUDGET,
          scope: PermissionScope.SELF,
        },
      ],
    });

    expect(caps).toContain('budget:read:own');
    expect(caps).not.toContain('budget:read');
  });

  it('maps global budget.read to budget:read', () => {
    const caps = capabilitiesFromAuthContext({
      ...staffUser(),
      permissions: [
        {
          action: PermissionAction.READ,
          resource: PermissionResource.BUDGET,
          scope: PermissionScope.GLOBAL,
        },
      ],
    });

    expect(caps).toContain('budget:read');
    expect(caps).not.toContain('budget:read:own');
  });
});
