import type {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';

export type AuthUserPermission = {
  action: PermissionAction;
  resource: PermissionResource;
  scope: PermissionScope;
};
