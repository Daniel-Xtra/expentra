import type { User } from 'src/database/entities/user.entity';
import type { Permission } from 'src/database/entities/permission.entity';
import type { IAuthUser } from 'src/definition';
import type { AuthUserPermission } from '../types/auth-user.types';

export function mapPermissionsFromRole(
  permissions: Permission[] | undefined,
): AuthUserPermission[] {
  if (!permissions?.length) {
    return [];
  }

  return permissions
    .filter((permission) => permission.isActive)
    .map((permission) => ({
      action: permission.action,
      resource: permission.resource,
      scope: permission.scope,
    }));
}

export function toAuthUser(
  user: User,
  options?: { managedDepartmentIds?: number[] },
): IAuthUser {
  const role = user.role;
  return {
    id: user.id,
    reference: user.reference,
    email: user.email,
    role: role?.name ?? '',
    roleId: role?.id ?? 0,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    departmentId: user.departmentId ?? null,
    managedDepartmentIds: options?.managedDepartmentIds ?? [],
    deactivatedAt: user.deactivatedAt ?? undefined,
    permissions: mapPermissionsFromRole(role?.permissions),
  };
}
