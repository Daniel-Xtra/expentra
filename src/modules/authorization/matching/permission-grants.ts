import type { AuthUserPermission } from '../types/auth-user.types';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';

function actionAndResourceMatch(
  permission: AuthUserPermission,
  action: PermissionAction,
  resource: PermissionResource,
): boolean {
  const actionMatches =
    permission.action === PermissionAction.MANAGE ||
    permission.action === action;
  const resourceMatches =
    permission.resource === PermissionResource.ALL ||
    permission.resource === resource;

  return actionMatches && resourceMatches;
}

/** Scope rules for a matched permission (resource/action pair). */
export function permissionScopeAllows(
  permission: AuthUserPermission,
  action: PermissionAction,
  resource: PermissionResource,
): boolean {
  if (resource === PermissionResource.EXPENSE) {
    if (action === PermissionAction.READ) {
      return (
        permission.scope === PermissionScope.GLOBAL ||
        permission.scope === PermissionScope.SELF
      );
    }

    if (
      action === PermissionAction.CREATE ||
      action === PermissionAction.UPDATE ||
      action === PermissionAction.DELETE ||
      action === PermissionAction.SUBMIT ||
      action === PermissionAction.REIMBURSE
    ) {
      return (
        permission.scope === PermissionScope.SELF ||
        permission.scope === PermissionScope.GLOBAL
      );
    }
  }

  if (resource === PermissionResource.RECEIPT) {
    if (
      action === PermissionAction.CREATE ||
      action === PermissionAction.READ ||
      action === PermissionAction.DELETE
    ) {
      return (
        permission.scope === PermissionScope.SELF ||
        permission.scope === PermissionScope.GLOBAL
      );
    }
  }

  if (resource === PermissionResource.APPROVAL) {
    if (
      action === PermissionAction.APPROVE ||
      action === PermissionAction.REJECT
    ) {
      return permission.scope === PermissionScope.GLOBAL;
    }

    if (
      action === PermissionAction.CREATE ||
      action === PermissionAction.READ ||
      action === PermissionAction.UPDATE ||
      action === PermissionAction.DELETE
    ) {
      return permission.scope === PermissionScope.GLOBAL;
    }
  }

  if (resource === PermissionResource.NOTIFICATION) {
    if (
      action === PermissionAction.READ ||
      action === PermissionAction.UPDATE ||
      action === PermissionAction.MARK
    ) {
      return permission.scope === PermissionScope.SELF;
    }
  }

  if (resource === PermissionResource.DASHBOARD) {
    if (action === PermissionAction.READ) {
      return (
        permission.scope === PermissionScope.SELF ||
        permission.scope === PermissionScope.GLOBAL
      );
    }
  }

  if (resource === PermissionResource.BUDGET) {
    if (action === PermissionAction.READ) {
      return (
        permission.scope === PermissionScope.GLOBAL ||
        permission.scope === PermissionScope.SELF
      );
    }

    return permission.scope === PermissionScope.GLOBAL;
  }

  if (
    resource === PermissionResource.REPORT ||
    resource === PermissionResource.APPROVAL_LEVEL ||
    resource === PermissionResource.DEPARTMENT ||
    resource === PermissionResource.ROLE ||
    resource === PermissionResource.USER ||
    resource === PermissionResource.POLICY ||
    resource === PermissionResource.AUDIT
  ) {
    return permission.scope === PermissionScope.GLOBAL;
  }

  return true;
}

/** Whether a stored permission grants the requested action on a resource. */
export function permissionGrants(
  permission: AuthUserPermission,
  action: PermissionAction,
  resource: PermissionResource,
  requiredScope?: PermissionScope,
): boolean {
  if (
    permission.action === PermissionAction.MANAGE &&
    (permission.resource === PermissionResource.ALL ||
      permission.resource === resource)
  ) {
    return requiredScope === undefined || permission.scope === requiredScope;
  }

  if (!actionAndResourceMatch(permission, action, resource)) {
    return false;
  }

  if (requiredScope !== undefined && permission.scope !== requiredScope) {
    return false;
  }

  // Unscoped budget READ (admin list / org APIs) requires GLOBAL.
  // budget.read.own must not satisfy ability.can('read', 'budget').
  if (
    requiredScope === undefined &&
    resource === PermissionResource.BUDGET &&
    action === PermissionAction.READ &&
    permission.scope === PermissionScope.SELF
  ) {
    return false;
  }

  return permissionScopeAllows(permission, action, resource);
}
