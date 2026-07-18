import { Permission } from 'src/database/entities/permission.entity';

export type PermissionResponse = {
  reference: string;
  name: string;
  resource: Permission['resource'];
  description: string | null;
  metadata: Permission['metadata'] | null;
  parentPermissionReference: string | null;
  parentPermission: {
    reference: string;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
  } | null;
};

export type PermissionsGroupedResponse = Record<string, PermissionResponse[]>;

export function toPermissionResponse(
  permission: Permission,
): PermissionResponse {
  const parentPermission = permission.parentPermission;

  return {
    reference: permission.reference,
    name: permission.name,
    resource: permission.resource,
    description: permission.description ?? null,
    metadata: permission.metadata ?? null,
    parentPermissionReference: parentPermission?.reference ?? null,
    parentPermission: parentPermission
      ? {
          reference: parentPermission.reference,
          name: parentPermission.name,
          description: parentPermission.description ?? null,
          metadata: parentPermission.metadata ?? null,
        }
      : null,
  };
}

export function groupPermissionsByParent(
  permissions: Permission[],
): PermissionsGroupedResponse {
  const grouped: PermissionsGroupedResponse = {};

  for (const permission of permissions) {
    const response = toPermissionResponse(permission);
    const parentKey = response.parentPermission?.name ?? 'ungroupedPermissions';

    if (!grouped[parentKey]) {
      grouped[parentKey] = [];
    }

    grouped[parentKey].push(response);
  }

  return grouped;
}
