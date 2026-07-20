import type { Permission } from 'src/database/entities/permission.entity';
import type { Role } from 'src/database/entities/role.entity';

export type RolePermissionResponse = {
  reference: string;
  name: string;
  displayName: string;
  resource: string;
  action: string;
  scope: string;
};

export type RoleResponse = {
  reference: string;
  name: string;
  description?: string | null;
  permissionCount?: number;
  permissions?: RolePermissionResponse[];
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

function toRolePermissionResponse(
  permission: Permission,
): RolePermissionResponse {
  return {
    reference: permission.reference,
    name: permission.name,
    displayName: permission.displayName,
    resource: permission.resource,
    action: permission.action,
    scope: permission.scope,
  };
}

export function toRoleResponse(
  role: Role & { permissionCount?: number },
  options?: { includePermissions?: boolean },
): RoleResponse {
  const response: RoleResponse = {
    reference: role.reference,
    name: role.name,
    description: role.description ?? null,
    permissionCount: role.permissionCount ?? role.permissions?.length ?? 0,
    metadata: role.metadata ?? null,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };

  if (options?.includePermissions) {
    response.permissions = (role.permissions ?? []).map(
      toRolePermissionResponse,
    );
  }

  return response;
}
