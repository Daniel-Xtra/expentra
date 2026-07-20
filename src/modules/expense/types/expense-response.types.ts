import type {
  ExpenseCategory,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';

export type ExpenseAttachmentResponse = {
  reference: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

export type ExpenseDepartmentResponse = {
  reference: string;
  name: string;
  code: string;
};

export type ExpenseApprovalResponse = {
  reference: string;
  decision: string;
  comment?: string;
  decidedAt: Date;
  level?: number;
  levelName?: string;
  metadata?: Record<string, unknown> | null;
};

export type ExpenseApprovalChainStepResponse = {
  level: number;
  name: string;
  approverType: 'department_manager' | 'finance_manager';
  status: 'waiting' | 'pending' | 'approved' | 'rejected';
  decidedAt?: Date;
  decidedBy?: ExpenseUserResponse;
};

export type ExpenseResponse = {
  reference: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  reimbursedAt?: Date;
  incurredAt?: Date;
  reimbursementReference?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  nextStep?: string;
  rejectionReason?: string;
  metadata?: Record<string, unknown> | null;
  attachments?: ExpenseAttachmentResponse[];
  approvals?: ExpenseApprovalResponse[];
  approvalChain?: ExpenseApprovalChainStepResponse[];
  canActOnApproval?: boolean;
  budgetWouldExceed?: boolean;
  requiresOverBudgetAcknowledgment?: boolean;
  primaryReceiptObjectKey?: string | null;
  department?: ExpenseDepartmentResponse | null;
  user?: ExpenseUserResponse | null;
};

export type ExpenseUserResponse = {
  reference: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
};

export type ExpenseReimbursementResponse = {
  reference: string;
  reimbursedAt: Date;
  reimbursementReference?: string | null;
};
