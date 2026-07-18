/** Relations required for department-scoped read/approve checks on expenses. */
export const EXPENSE_POLICY_RELATIONS = {
  department: true,
  user: { department: true },
  attachments: true,
  approvals: { approvalLevel: { role: true }, approver: true },
} as const;
