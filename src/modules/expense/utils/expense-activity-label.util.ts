import { AuditAction } from 'src/database/entities/audit-log.enums';
import type { ExpenseActivityItem } from '../services/expense-comment.service';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  [AuditAction.EXPENSE_CREATED]: 'Expense created',
  [AuditAction.EXPENSE_SUBMITTED]: 'Submitted for approval',
  [AuditAction.EXPENSE_APPROVED]: 'Approved',
  [AuditAction.EXPENSE_REJECTED]: 'Rejected',
  [AuditAction.EXPENSE_REIMBURSED]: 'Marked as reimbursed',
  [AuditAction.EXPENSE_REOPENED]: 'Reopened as draft',
  [AuditAction.EXPENSE_COMMENT_ADDED]: 'Comment added',
  [AuditAction.POLICY_VIOLATION]: 'Policy exception noted',
  [AuditAction.DELEGATION_CREATED]: 'Delegation created',
  [AuditAction.DELEGATION_REVOKED]: 'Delegation revoked',
};

export function formatExpenseActivityLabel(item: ExpenseActivityItem): string {
  const summary = item.summary?.trim();
  if (!summary) {
    return 'Activity update';
  }

  if (item.type === 'AUDIT') {
    const base =
      AUDIT_ACTION_LABELS[summary] ??
      summary
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());

    if (summary === AuditAction.EXPENSE_REJECTED) {
      const comment = item.metadata?.comment;
      if (typeof comment === 'string' && comment.trim()) {
        return `${base}: ${comment.trim()}`;
      }
    }

    return base;
  }

  return summary;
}
