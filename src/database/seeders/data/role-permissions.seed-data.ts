import { APPROVAL_ROLES } from '../../constants/approval-roles';
import { SYSTEM_ROLES } from '../../constants/system-roles';
import type { Permission } from '../../entities/permission.entity';

/** Default self-service permissions for staff and managers. */
export const STAFF_PERMISSION_NAMES = [
  'expense.create',
  'expense.read.own',
  'expense.update',
  'expense.delete',
  'expense.submit',
  'receipt.upload',
  'receipt.read',
  'receipt.delete',
  'notification.read.own',
  'notification.update.own',
  'notification.mark.own',
  'dashboard.read.own',
] as const;

const FINANCE_MANAGER_PERMISSION_NAMES = [
  'notification.read.own',
  'notification.update.own',
  'notification.mark.own',
  'approval.approve',
  'approval.reject',
  'expense.read.all',
  'expense.reimburse',
  'receipt.read.all',
  'report.read',
  'report.export',
  'budget.read',
  'policy.read',
  'policy.create',
  'policy.update',
  'policy.delete',
  'dashboard.read.own',
] as const;

const ROLE_PERMISSION_NAMES: Record<string, readonly string[] | '*'> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: '*',
  [SYSTEM_ROLES.STAFF]: STAFF_PERMISSION_NAMES,
  [APPROVAL_ROLES.FINANCE_MANAGER]: FINANCE_MANAGER_PERMISSION_NAMES,
};

export function resolveRolePermissions(
  roleName: string,
  allPermissions: Permission[],
): Permission[] {
  const configured = ROLE_PERMISSION_NAMES[roleName];
  if (!configured) {
    return [];
  }
  if (configured === '*') {
    return allPermissions.filter((permission) => permission.isActive);
  }
  const names = new Set(configured);
  return allPermissions.filter(
    (permission) => permission.isActive && names.has(permission.name),
  );
}
