/** Prefix for externally exposed entity references ({PREFIX}{timestampMs}{suffix}). */
export const EntityReferencePrefix = {
  PARENT_PERMISSION: 'ppr',
  PERMISSION: 'prm',
  ROLE: 'rol',
  DEPARTMENT: 'dep',
  USER: 'usr',
  DEPARTMENT_BUDGET: 'bgt',
  EXPENSE: 'exp',
  EXPENSE_ATTACHMENT: 'rcp',
  APPROVAL_LEVEL: 'apl',
  EXPENSE_APPROVAL: 'apv',
  NOTIFICATION: 'ntf',
  AUDIT_LOG: 'aud',
  EXPENSE_POLICY: 'epo',
  POLICY_CONDITION_FIELD: 'pcf',
  POLICY_RULE_TEMPLATE: 'prt',
  EXPENSE_COMMENT: 'ecm',
  APPROVAL_DELEGATION: 'dlg',
  DEPARTMENT_MANAGER_HISTORY: 'dmh',
} as const;

export type EntityReferencePrefix =
  (typeof EntityReferencePrefix)[keyof typeof EntityReferencePrefix];

export const ENTITY_REFERENCE_SUFFIX_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const ENTITY_REFERENCE_SUFFIX_LENGTH = 6;

export const ENTITY_REFERENCE_TIMESTAMP_LENGTH = 13;

export const ENTITY_REFERENCE_MAX_LENGTH =
  3 + ENTITY_REFERENCE_TIMESTAMP_LENGTH + ENTITY_REFERENCE_SUFFIX_LENGTH;

/** @example EXP1749078456123A7B9C2 */
export const ENTITY_REFERENCE_PATTERN = /^[A-Z]{3}\d{13}[A-Z0-9]{6}$/;

export const ENTITY_REFERENCE_EXAMPLES = {
  user: 'USR1749078456123A7B9C2',
  expense: 'EXP1749078456123A7B9C2',
  department: 'DEP1749078456123K4M8P2',
  role: 'ROL1749078456123X3N6R9',
} as const;
