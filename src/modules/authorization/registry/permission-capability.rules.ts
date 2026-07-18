import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import type { AuthUserPermission } from '../types/auth-user.types';

/** Maps a stored permission tuple to frontend capability keys. */
export function capabilitiesForPermission(
  permission: AuthUserPermission,
): readonly string[] {
  const caps = new Set<string>();
  caps.add(`${permission.resource}:${permission.action}`);

  if (permission.scope === PermissionScope.SELF) {
    caps.add(`${permission.resource}:${permission.action}:own`);
  }

  if (
    permission.resource === PermissionResource.EXPENSE &&
    permission.action === PermissionAction.READ &&
    permission.scope === PermissionScope.GLOBAL
  ) {
    caps.add('expense:read:company');
  }

  if (
    permission.resource === PermissionResource.EXPENSE &&
    permission.action === PermissionAction.CREATE
  ) {
    caps.add('expense:create');
  }

  if (
    permission.resource === PermissionResource.USER &&
    permission.action === PermissionAction.READ
  ) {
    caps.add('user:read');
  }

  if (
    permission.resource === PermissionResource.USER &&
    permission.action === PermissionAction.UPDATE
  ) {
    caps.add('user:update');
  }

  if (
    permission.resource === PermissionResource.ROLE &&
    permission.action === PermissionAction.READ
  ) {
    caps.add('role:read');
  }

  if (
    permission.resource === PermissionResource.DEPARTMENT &&
    permission.action === PermissionAction.READ
  ) {
    caps.add('department:read');
  }

  if (
    permission.resource === PermissionResource.APPROVAL &&
    (permission.action === PermissionAction.APPROVE ||
      permission.action === PermissionAction.REJECT)
  ) {
    caps.add('expense:read:submitted');
    caps.add('approval:approve');
    caps.add('approval:reject');
    caps.add('approval:read');
    if (permission.scope === PermissionScope.GLOBAL) {
      caps.add('approval:approve:global');
      caps.add('approval:reject:global');
    }
  }

  if (permission.resource === PermissionResource.BUDGET) {
    if (permission.action === PermissionAction.READ) {
      // Own-department utilization (staff) must not unlock admin budget:read.
      if (permission.scope === PermissionScope.SELF) {
        caps.delete('budget:read');
        caps.add('budget:read:own');
      } else {
        caps.add('budget:read');
      }
    }
  }

  if (permission.resource === PermissionResource.REPORT) {
    if (permission.action === PermissionAction.READ) {
      caps.add('report:read');
    }
    if (permission.action === PermissionAction.EXPORT) {
      caps.add('report:export');
    }
  }

  if (permission.resource === PermissionResource.NOTIFICATION) {
    if (permission.action === PermissionAction.READ) {
      caps.add('notification:read');
    }
    if (permission.action === PermissionAction.UPDATE) {
      caps.add('notification:update');
    }
    if (permission.action === PermissionAction.MARK) {
      caps.add('notification:mark');
    }
  }

  if (permission.resource === PermissionResource.DASHBOARD) {
    if (permission.action === PermissionAction.READ) {
      caps.add('dashboard:read');
      if (permission.scope === PermissionScope.GLOBAL) {
        caps.add('dashboard:read:team');
      }
    }
  }

  if (permission.resource === PermissionResource.POLICY) {
    caps.add(`policy:${permission.action}`);
  }

  if (permission.resource === PermissionResource.AUDIT) {
    if (permission.action === PermissionAction.READ) {
      caps.add('audit:read');
    }
  }

  if (permission.resource === PermissionResource.RECEIPT) {
    if (permission.action === PermissionAction.CREATE) {
      caps.add('receipt:upload');
    }
    if (permission.action === PermissionAction.READ) {
      caps.add('receipt:read');
      if (permission.scope === PermissionScope.GLOBAL) {
        caps.add('receipt:read:all');
      }
      if (permission.scope === PermissionScope.SELF) {
        caps.add('receipt:read:own');
      }
    }
  }

  if (
    permission.resource === PermissionResource.EXPENSE &&
    permission.action === PermissionAction.REIMBURSE
  ) {
    caps.add('expense:reimburse');
  }

  return [...caps];
}
