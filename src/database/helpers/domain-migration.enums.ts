/** PostgreSQL enum labels — keep in sync with entity enums. */

export const EXPENSE_STATUS_VALUES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REIMBURSED',
] as const;

export const APPROVAL_DECISION_VALUES = ['APPROVED', 'REJECTED'] as const;

export const NOTIFICATION_CHANNEL_VALUES = ['EMAIL', 'IN_APP'] as const;

export const NOTIFICATION_STATUS_VALUES = [
  'PENDING',
  'SENT',
  'FAILED',
] as const;

export const PERMISSION_ACTION_VALUES = [
  'manage',
  'create',
  'read',
  'update',
  'delete',
  'submit',
  'approve',
  'reject',
  'reimburse',
  'export',
  'mark',
  'upload',
] as const;

export const PERMISSION_RESOURCE_VALUES = [
  'all',
  'expense',
  'user',
  'approval',
  'approval_level',
  'receipt',
  'notification',
  'budget',
  'report',
  'department',
  'role',
  'audit',
  'policy',
  'dashboard',
] as const;

export const PERMISSION_SCOPE_VALUES = ['global', 'self'] as const;

export const EXPENSE_STATUS_ENUM = 'expense_status_enum';
export const APPROVAL_DECISION_ENUM = 'approval_decision_enum';
export const NOTIFICATION_CHANNEL_ENUM = 'notification_channel_enum';
export const NOTIFICATION_STATUS_ENUM = 'notification_status_enum';
export const PERMISSION_ACTION_ENUM = 'permissions_action_enum';
export const PERMISSION_RESOURCE_ENUM = 'permissions_resource_enum';
export const PERMISSION_SCOPE_ENUM = 'permissions_scope_enum';

export const EXPENSE_CATEGORY_VARCHAR_LENGTH = 64;
export const NOTIFICATION_TYPE_VARCHAR_LENGTH = 64;
