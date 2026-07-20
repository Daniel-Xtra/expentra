export enum PermissionAction {
  MANAGE = 'manage',
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  REIMBURSE = 'reimburse',
  EXPORT = 'export',
  MARK = 'mark',
  UPLOAD = 'upload',
}

export enum PermissionResource {
  ALL = 'all',
  EXPENSE = 'expense',
  USER = 'user',
  APPROVAL = 'approval',
  APPROVAL_LEVEL = 'approval_level',
  RECEIPT = 'receipt',
  NOTIFICATION = 'notification',
  BUDGET = 'budget',
  REPORT = 'report',
  DEPARTMENT = 'department',
  ROLE = 'role',
  AUDIT = 'audit',
  POLICY = 'policy',
  DASHBOARD = 'dashboard',
}

export enum PermissionScope {
  GLOBAL = 'global',
  SELF = 'self',
}

export enum ParentPermissionResource {
  VIEW_DASHBOARD_MANAGEMENT = 'view_dashboard_management',
  VIEW_ADMIN_MANAGEMENT = 'view_admin_management',
  VIEW_USER_MANAGEMENT = 'view_user_management',
  VIEW_ROLE_MANAGEMENT = 'view_role_management',
  VIEW_PERMISSION_MANAGEMENT = 'view_permission_management',
  VIEW_DEPARTMENT_MANAGEMENT = 'view_department_management',
  VIEW_EXPENSE_MANAGEMENT = 'view_expense_management',
  VIEW_APPROVAL_MANAGEMENT = 'view_approval_management',
  VIEW_RECEIPT_MANAGEMENT = 'view_receipt_management',
  VIEW_BUDGET_MANAGEMENT = 'view_budget_management',
  VIEW_REPORT_MANAGEMENT = 'view_report_management',
  VIEW_NOTIFICATION_MANAGEMENT = 'view_notification_management',
}
