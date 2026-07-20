import { Permission } from 'src/database/entities/permission.entity';

export type PermissionResponse = {
  reference: string;
  name: string;
  displayName: string;
  resource: Permission['resource'];
  action: Permission['action'];
  scope: Permission['scope'];
  isActive: boolean;
  permissionString: string;
  parentPermission: {
    reference: string;
    name: string;
    displayName: string;
  } | null;
};

export function toPermissionResponse(
  permission: Permission,
): PermissionResponse {
  const parentPermission = permission.parentPermission;

  return {
    reference: permission.reference,
    name: permission.name,
    displayName: permission.displayName,
    resource: permission.resource,
    action: permission.action,
    scope: permission.scope,
    isActive: permission.isActive,
    permissionString: permission.permissionString,
    parentPermission: parentPermission
      ? {
          reference: parentPermission.reference,
          name: parentPermission.name,
          displayName: parentPermission.displayName,
        }
      : null,
  };
}
