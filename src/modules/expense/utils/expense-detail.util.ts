import {
  ApprovalDecision,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type { Expense } from 'src/database/entities/expense.entity';
import type { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import type { ApprovalChainStep } from 'src/modules/approval/services/approval-routing.service';

export function extractRejectionReason(
  approvals?: ExpenseApproval[],
): string | undefined {
  if (!approvals?.length) {
    return undefined;
  }

  const rejection = [...approvals]
    .filter((approval) => approval.decision === ApprovalDecision.REJECTED)
    .sort(
      (left, right) => right.decidedAt.getTime() - left.decidedAt.getTime(),
    )[0];

  const comment = rejection?.comment?.trim();
  return comment || undefined;
}

export function buildExpenseNextStep(
  expense: Pick<Expense, 'status' | 'reimbursedAt'>,
  approvalChain?: ApprovalChainStep[],
): string {
  switch (expense.status) {
    case ExpenseStatus.DRAFT:
      return 'Submit for approval when the claim is ready.';
    case ExpenseStatus.SUBMITTED:
    case ExpenseStatus.UNDER_REVIEW: {
      const pendingStep = approvalChain?.find(
        (step) => step.status === 'pending',
      );
      if (pendingStep) {
        return `Waiting for ${pendingStep.name.toLowerCase()}.`;
      }
      return 'In the approval queue.';
    }
    case ExpenseStatus.APPROVED:
      return 'Approved — awaiting reimbursement from finance.';
    case ExpenseStatus.REJECTED:
      return 'Rejected — reopen as a draft to edit and resubmit.';
    case ExpenseStatus.REIMBURSED:
      if (expense.reimbursedAt) {
        return `Reimbursed on ${expense.reimbursedAt.toLocaleDateString(
          'en-GB',
          {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          },
        )}.`;
      }
      return 'Reimbursement completed.';
    default:
      return 'No further action required.';
  }
}

export function buildReimbursementReference(
  expenseReference: string,
  reimbursedAt: Date,
): string {
  const datePart = reimbursedAt.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = expenseReference.replace(/-/g, '').slice(-6).toUpperCase();
  return `PAY-${datePart}-${suffix}`;
}
