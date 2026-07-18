/** Role names referenced by approval levels (seeded by migration when missing). */
export const APPROVAL_ROLES = {
  FINANCE_MANAGER: 'finance_manager',
} as const;

export type ApprovalRoleName =
  (typeof APPROVAL_ROLES)[keyof typeof APPROVAL_ROLES];
