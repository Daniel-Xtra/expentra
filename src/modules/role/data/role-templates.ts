import { STAFF_PERMISSION_NAMES } from 'src/database/seeders/data/role-permissions.seed-data';

export type RoleTemplate = {
  key: string;
  name: string;
  description: string;
  permissionNames: readonly string[];
};

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
  'audit.read',
] as const;

const HR_ADMIN_PERMISSION_NAMES = [
  'notification.read.own',
  'notification.update.own',
  'notification.mark.own',
  'dashboard.read.own',
  'user.read',
  'user.update',
  'department.read',
  'department.create',
  'department.update',
] as const;

const PLATFORM_ADMIN_PERMISSION_NAMES = [
  'notification.read.own',
  'notification.update.own',
  'notification.mark.own',
  'dashboard.read.own',
  'role.create',
  'role.read',
  'role.update',
  'role.delete',
  'approval_level.create',
  'approval_level.read',
  'approval_level.update',
  'approval_level.delete',
  'audit.read',
] as const;

/** Starter permission sets for custom roles — not tied to system role names. */
export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: 'staff',
    name: 'Staff (self-service)',
    description:
      'Submit and manage own expenses. Pair with department manager assignment for approvals.',
    permissionNames: STAFF_PERMISSION_NAMES,
  },
  {
    key: 'hr_admin',
    name: 'HR administrator',
    description: 'Manage employees and departments (users join via self sign-up).',
    permissionNames: HR_ADMIN_PERMISSION_NAMES,
  },
  {
    key: 'finance_manager',
    name: 'Finance manager',
    description: 'Approve expenses, reimburse, run reports, and manage policies.',
    permissionNames: FINANCE_MANAGER_PERMISSION_NAMES,
  },
  {
    key: 'platform_admin',
    name: 'Platform administrator',
    description: 'Manage roles, approval workflow configuration, and audit access.',
    permissionNames: PLATFORM_ADMIN_PERMISSION_NAMES,
  },
] as const;

const TEMPLATE_BY_KEY = new Map(ROLE_TEMPLATES.map((template) => [template.key, template]));

export function findRoleTemplate(key: string): RoleTemplate | undefined {
  return TEMPLATE_BY_KEY.get(key);
}

export function listRoleTemplates(): RoleTemplate[] {
  return [...ROLE_TEMPLATES];
}
