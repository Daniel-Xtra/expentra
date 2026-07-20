import { ForbiddenException } from '@nestjs/common';
import { SYSTEM_ROLES } from '../../../database/constants/system-roles';
import { Role } from '../../../database/entities/role.entity';
import type { IAuthUser } from '../../../definition';
import { assertCanAssignRole } from './role-assignment.policy';

function actor(role: string): IAuthUser {
  return {
    id: 1,
    reference: 'usr_actor',
    email: 'actor@example.com',
    role,
    roleId: 1,
    isActive: true,
    isEmailVerified: true,
    managedDepartmentIds: [],
    permissions: [],
  };
}

function superAdminRole(): Role {
  return Object.assign(new Role(), {
    id: 1,
    name: SYSTEM_ROLES.SUPER_ADMIN,
  });
}

describe('assertCanAssignRole', () => {
  it('allows super admin to assign super admin role', () => {
    expect(() =>
      assertCanAssignRole(actor(SYSTEM_ROLES.SUPER_ADMIN), superAdminRole()),
    ).not.toThrow();
  });

  it('blocks non-super-admin from assigning super admin role', () => {
    expect(() => assertCanAssignRole(actor('staff'), superAdminRole())).toThrow(
      ForbiddenException,
    );
  });
});
