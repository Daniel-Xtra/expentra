export const ROLE_PERMISSIONS_CHANGED_EVENT = 'role.permissions_changed';

export type RolePermissionsChangedEvent = {
  actorUserId: number;
  roleReference: string;
  permissionNames: string[];
};
