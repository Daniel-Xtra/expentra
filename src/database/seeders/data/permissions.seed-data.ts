import {
  ParentPermissionResource,
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from 'src/modules/authorization/constants/permissions';

export type PermissionSeed = {
  name: string;
  displayName: string;
  description?: string;
  resource: PermissionResource;
  action: PermissionAction;
  scope?: PermissionScope;
  parent: ParentPermissionResource;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
};

/** Canonical permission catalog — keep in sync with route guards and access policies. */
export const PERMISSION_SEEDS: PermissionSeed[] = [
  // Expenses (staff self-service)
  {
    name: 'expense.create',
    displayName: 'Create Expense',
    description: 'Create an expense draft',
    resource: PermissionResource.EXPENSE,
    action: PermissionAction.CREATE,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
  },
  {
    name: 'expense.read.own',
    displayName: 'Read Own Expenses',
    description: 'View your own expenses',
    resource: PermissionResource.EXPENSE,
    action: PermissionAction.READ,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
  },
  {
    name: 'expense.read.all',
    displayName: 'Read All Expenses',
    description: 'View all expenses in the organization',
    resource: PermissionResource.EXPENSE,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
  },
  {
    name: 'expense.update',
    displayName: 'Update Expense',
    description: 'Update an expense draft',
    resource: PermissionResource.EXPENSE,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
  },
  {
    name: 'expense.delete',
    displayName: 'Delete Expense',
    description: 'Delete an expense draft',
    resource: PermissionResource.EXPENSE,
    action: PermissionAction.DELETE,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
  },
  {
    name: 'expense.submit',
    displayName: 'Submit Expense',
    description: 'Submit an expense for approval',
    resource: PermissionResource.EXPENSE,
    action: PermissionAction.SUBMIT,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
  },
  {
    name: 'expense.reimburse',
    displayName: 'Mark Reimbursed',
    description: 'Mark an approved expense as reimbursed',
    resource: PermissionResource.EXPENSE,
    action: PermissionAction.REIMBURSE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
  },

  // Receipts
  {
    name: 'receipt.upload',
    displayName: 'Upload Receipt',
    description: 'Upload a receipt on a draft expense',
    resource: PermissionResource.RECEIPT,
    action: PermissionAction.CREATE,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_RECEIPT_MANAGEMENT,
  },
  {
    name: 'receipt.read',
    displayName: 'Read Own Receipts',
    description: 'View and download receipts on your expenses',
    resource: PermissionResource.RECEIPT,
    action: PermissionAction.READ,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_RECEIPT_MANAGEMENT,
  },
  {
    name: 'receipt.read.all',
    displayName: 'Read All Receipts',
    description: 'View and download receipts on any expense',
    resource: PermissionResource.RECEIPT,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_RECEIPT_MANAGEMENT,
  },
  {
    name: 'receipt.delete',
    displayName: 'Delete Receipt',
    description: 'Remove a receipt from a draft expense',
    resource: PermissionResource.RECEIPT,
    action: PermissionAction.DELETE,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_RECEIPT_MANAGEMENT,
  },

  // Approvals
  {
    name: 'approval.approve',
    displayName: 'Approve Expense (organization-wide)',
    description: 'Approve submitted expenses',
    resource: PermissionResource.APPROVAL,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'approval.reject',
    displayName: 'Reject Expense (organization-wide)',
    description: 'Reject submitted expenses',
    resource: PermissionResource.APPROVAL,
    action: PermissionAction.REJECT,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'approval_level.create',
    displayName: 'Create Approval Level',
    description: 'Configure approval workflow levels',
    resource: PermissionResource.APPROVAL_LEVEL,
    action: PermissionAction.CREATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'approval_level.read',
    displayName: 'Read Approval Levels',
    description: 'View approval workflow levels',
    resource: PermissionResource.APPROVAL_LEVEL,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'approval_level.update',
    displayName: 'Update Approval Levels',
    description: 'Update approval workflow levels',
    resource: PermissionResource.APPROVAL_LEVEL,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'approval_level.delete',
    displayName: 'Delete Approval Levels',
    description: 'Remove approval workflow levels',
    resource: PermissionResource.APPROVAL_LEVEL,
    action: PermissionAction.DELETE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },

  // Budgets
  {
    name: 'budget.create',
    displayName: 'Create Department Budget',
    description: 'Set annual department budget limits',
    resource: PermissionResource.BUDGET,
    action: PermissionAction.CREATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_BUDGET_MANAGEMENT,
  },
  {
    name: 'budget.read',
    displayName: 'Read Budgets',
    description: 'View departments budgets and utilization',
    resource: PermissionResource.BUDGET,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_BUDGET_MANAGEMENT,
  },
  {
    name: 'budget.read.own',
    displayName: 'Read Own Departments Budget',
    description: 'View your department budget utilization',
    resource: PermissionResource.BUDGET,
    action: PermissionAction.READ,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_BUDGET_MANAGEMENT,
  },
  {
    name: 'budget.update',
    displayName: 'Update Budgets',
    description: 'Update departments budget limits',
    resource: PermissionResource.BUDGET,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_BUDGET_MANAGEMENT,
  },

  // Reporting
  {
    name: 'report.read',
    displayName: 'Read Reports',
    description: 'View spending analytics and summaries',
    resource: PermissionResource.REPORT,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_REPORT_MANAGEMENT,
  },
  {
    name: 'report.export',
    displayName: 'Export Reports',
    description: 'Export reports (Excel/PDF)',
    resource: PermissionResource.REPORT,
    action: PermissionAction.EXPORT,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_REPORT_MANAGEMENT,
  },

  // Departments
  {
    name: 'department.create',
    displayName: 'Create Department',
    description: 'Create a department',
    resource: PermissionResource.DEPARTMENT,
    action: PermissionAction.CREATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_DEPARTMENT_MANAGEMENT,
  },
  {
    name: 'department.read',
    displayName: 'Read Departments',
    description: 'List and view departments',
    resource: PermissionResource.DEPARTMENT,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_DEPARTMENT_MANAGEMENT,
  },
  {
    name: 'department.update',
    displayName: 'Update Departments',
    description: 'Update department details',
    resource: PermissionResource.DEPARTMENT,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_DEPARTMENT_MANAGEMENT,
  },
  {
    name: 'department.delete',
    displayName: 'Delete Departments',
    description: 'Remove departments without assigned users',
    resource: PermissionResource.DEPARTMENT,
    action: PermissionAction.DELETE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_DEPARTMENT_MANAGEMENT,
  },

  // Roles
  {
    name: 'role.create',
    displayName: 'Create Role',
    description: 'Create a role',
    resource: PermissionResource.ROLE,
    action: PermissionAction.CREATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_ROLE_MANAGEMENT,
  },
  {
    name: 'role.read',
    displayName: 'Read Roles',
    description: 'List and view roles',
    resource: PermissionResource.ROLE,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_ROLE_MANAGEMENT,
  },
  {
    name: 'role.update',
    displayName: 'Update Roles',
    description: 'Update roles and permission assignments',
    resource: PermissionResource.ROLE,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_ROLE_MANAGEMENT,
  },
  {
    name: 'role.delete',
    displayName: 'Delete Roles',
    description: 'Remove roles without assigned users',
    resource: PermissionResource.ROLE,
    action: PermissionAction.DELETE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_ROLE_MANAGEMENT,
  },

  // Notifications (in-app inbox)
  {
    name: 'notification.read.own',
    displayName: 'Read Own Notifications',
    description: 'View in-app notifications',
    resource: PermissionResource.NOTIFICATION,
    action: PermissionAction.READ,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_NOTIFICATION_MANAGEMENT,
  },
  {
    name: 'notification.update.own',
    displayName: 'Update Own Notification Preferences',
    description: 'Manage notification delivery preferences',
    resource: PermissionResource.NOTIFICATION,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_NOTIFICATION_MANAGEMENT,
  },
  {
    name: 'notification.mark.own',
    displayName: 'Mark Own Notifications Read',
    description: 'Mark in-app notifications as read',
    resource: PermissionResource.NOTIFICATION,
    action: PermissionAction.MARK,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_NOTIFICATION_MANAGEMENT,
  },

  // Dashboards
  {
    name: 'dashboard.read.own',
    displayName: 'Read Personal Dashboard',
    description: 'View personal spending dashboard',
    resource: PermissionResource.DASHBOARD,
    action: PermissionAction.READ,
    scope: PermissionScope.SELF,
    parent: ParentPermissionResource.VIEW_DASHBOARD_MANAGEMENT,
  },
  // {
  //   name: 'dashboard.read.team',
  //   displayName: 'Read Team Dashboard',
  //   description: 'View department team dashboard',
  //   resource: PermissionResource.DASHBOARD,
  //   action: PermissionAction.READ,
  //   scope: PermissionScope.GLOBAL,
  //   parent: ParentPermissionResource.VIEW_DASHBOARD_MANAGEMENT,
  // },

  // Expense policies
  {
    name: 'policy.create',
    displayName: 'Create Expense Policy',
    description: 'Create expense compliance policies',
    resource: PermissionResource.POLICY,
    action: PermissionAction.CREATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'policy.read',
    displayName: 'Read Expense Policies',
    description: 'View expense compliance policies',
    resource: PermissionResource.POLICY,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'policy.update',
    displayName: 'Update Expense Policies',
    description: 'Update expense compliance policies',
    resource: PermissionResource.POLICY,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },
  {
    name: 'policy.delete',
    displayName: 'Delete Expense Policies',
    description: 'Delete expense compliance policies',
    resource: PermissionResource.POLICY,
    action: PermissionAction.DELETE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
  },

  // Audit logs
  {
    name: 'audit.read',
    displayName: 'Read Audit Logs',
    description: 'View organization audit trail',
    resource: PermissionResource.AUDIT,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_ADMIN_MANAGEMENT,
  },

  // Users
  {
    name: 'user.read',
    displayName: 'Read Users',
    description: 'View users',
    resource: PermissionResource.USER,
    action: PermissionAction.READ,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_USER_MANAGEMENT,
  },
  {
    name: 'user.update',
    displayName: 'Update Users',
    description: 'Update user profiles and assignments',
    resource: PermissionResource.USER,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.GLOBAL,
    parent: ParentPermissionResource.VIEW_USER_MANAGEMENT,
  },
];

/** Retired permission names — deactivated on re-seed. */
export const RETIRED_PERMISSION_NAMES = [
  'approval.approve.department',
  'approval.reject.department',
  'user.create',
] as const;
