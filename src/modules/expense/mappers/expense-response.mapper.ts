import type { Expense } from 'src/database/entities/expense.entity';

import type { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';

import type { ExpenseApproval } from 'src/database/entities/expense-approval.entity';

import { parseAmount } from '../utils/amount.util';

import {
  buildExpenseNextStep,
  extractRejectionReason,
} from '../utils/expense-detail.util';

import type {
  ExpenseApprovalResponse,
  ExpenseAttachmentResponse,
  ExpenseApprovalChainStepResponse,
  ExpenseReimbursementResponse,
  ExpenseResponse,
  ExpenseUserResponse,
} from '../types/expense-response.types';
import type { ApprovalChainStep } from 'src/modules/approval/services/approval-routing.service';

export type {
  ExpenseApprovalResponse,
  ExpenseAttachmentResponse,
  ExpenseDepartmentResponse,
  ExpenseResponse,
  ExpenseUserResponse,
} from '../types/expense-response.types';

function toAttachmentResponse(
  attachment: ExpenseAttachment,
): ExpenseAttachmentResponse {
  return {
    reference: attachment.reference,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    objectKey: attachment.objectKey,
    metadata: attachment.metadata ?? null,
    createdAt: attachment.createdAt,
  };
}

export function toApprovalResponse(
  approval: ExpenseApproval,
): ExpenseApprovalResponse {
  return {
    reference: approval.reference,
    decision: approval.decision,
    comment: approval.comment,
    decidedAt: approval.decidedAt,
    level: approval.approvalLevel?.level,
    levelName: approval.approvalLevel?.name,
    metadata: approval.metadata ?? null,
  };
}

function toApprovalChainStepResponse(
  step: ApprovalChainStep,
): ExpenseApprovalChainStepResponse {
  return {
    level: step.level,
    name: step.name,
    approverType: step.approverType,
    status: step.status,
    decidedAt: step.decidedAt,
    decidedBy: step.decidedBy,
  };
}

function sortApprovals(approvals: ExpenseApproval[]): ExpenseApproval[] {
  return [...approvals].sort((left, right) => {
    const leftLevel = left.approvalLevel?.level ?? 0;
    const rightLevel = right.approvalLevel?.level ?? 0;
    if (leftLevel !== rightLevel) {
      return leftLevel - rightLevel;
    }

    return left.decidedAt.getTime() - right.decidedAt.getTime();
  });
}

export function toReimbursementResponse(
  reimbursement: Expense,
): ExpenseReimbursementResponse {
  if (!reimbursement.reimbursedAt) {
    throw new Error('Expense has not been reimbursed');
  }

  return {
    reference: reimbursement.reference,
    reimbursedAt: reimbursement.reimbursedAt,
    reimbursementReference: reimbursement.reimbursementReference ?? null,
  };
}

function toExpenseUserResponse(
  user: NonNullable<Expense['user']>,
): ExpenseUserResponse {
  return {
    reference: user.reference,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl ?? null,
    isActive: user.isActive,
  };
}

function toDepartmentResponse(expense: Expense) {
  if (!expense.department) {
    return null;
  }

  return {
    reference: expense.department.reference,
    name: expense.department.name,
    code: expense.department.code,
  };
}

function pickPrimaryReceiptObjectKey(expense: Expense): string | null {
  const attachments = expense.attachments ?? [];
  const image = attachments.find((attachment) =>
    (attachment.mimeType ?? '').startsWith('image/'),
  );
  const chosen = image ?? attachments[0];
  return chosen?.objectKey ?? null;
}

export function toExpenseResponse(
  expense: Expense,
  options?: {
    includeRelations?: boolean;
    canActOnApproval?: boolean;
    approvalChain?: ApprovalChainStep[];
    budgetWouldExceed?: boolean;
    requiresOverBudgetAcknowledgment?: boolean;
    includePrimaryReceipt?: boolean;
  },
): ExpenseResponse {
  const response: ExpenseResponse = {
    reference: expense.reference,
    title: expense.title,
    description: expense.description,
    amount: parseAmount(expense.amount),
    currency: expense.currency,
    category: expense.category,
    status: expense.status,
    submittedAt: expense.submittedAt,
    approvedAt: expense.approvedAt,
    rejectedAt: expense.rejectedAt,
    reimbursedAt: expense.reimbursedAt,
    incurredAt: expense.incurredAt,
    reimbursementReference: expense.reimbursementReference ?? null,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    metadata: expense.metadata ?? null,
  };

  if (expense.user) {
    response.user = toExpenseUserResponse(expense.user);
  }

  if (expense.department) {
    response.department = toDepartmentResponse(expense);
  }

  if (options?.budgetWouldExceed !== undefined) {
    response.budgetWouldExceed = options.budgetWouldExceed;
  }

  if (options?.requiresOverBudgetAcknowledgment !== undefined) {
    response.requiresOverBudgetAcknowledgment =
      options.requiresOverBudgetAcknowledgment;
  }

  if (options?.includePrimaryReceipt) {
    response.primaryReceiptObjectKey = pickPrimaryReceiptObjectKey(expense);
  }

  if (!options?.includeRelations) {
    return response;
  }

  const approvals = expense.approvals
    ? sortApprovals(expense.approvals).map(toApprovalResponse)
    : undefined;

  return {
    ...response,
    attachments: expense.attachments?.map(toAttachmentResponse),
    approvals,
    approvalChain: options?.approvalChain?.map(toApprovalChainStepResponse),
    canActOnApproval: options?.canActOnApproval,
    rejectionReason: extractRejectionReason(expense.approvals),
    nextStep: buildExpenseNextStep(expense, options?.approvalChain),
  };
}
