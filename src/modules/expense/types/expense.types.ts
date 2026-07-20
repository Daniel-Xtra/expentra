import type { Expense } from 'src/database/entities/expense.entity';
import type {
  ExpenseCategory,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type {
  ExpenseListSortField,
  ExpenseListSortOrder,
} from '../dtos/list-expenses.query.dto';

/** Input for creating a draft expense (amount is in minor currency units). */
export interface CreateExpenseInput {
  title: string;
  description?: string;
  amount: number;
  category: ExpenseCategory;
  incurredAt?: string;
}

export interface UpdateExpenseInput {
  title?: string;
  description?: string;
  amount?: number;
  category?: ExpenseCategory;
  incurredAt?: string | null;
}

export interface ListExpensesQuery {
  page?: number;
  limit?: number;
  status?: ExpenseStatus;
  actionableOnly?: boolean;
  needsAction?: boolean;
  agingOnly?: boolean;
  sortBy?: ExpenseListSortField;
  sortOrder?: ExpenseListSortOrder;
}

export interface PaginatedExpensesMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedExpensesResult {
  data: Expense[];
  meta: PaginatedExpensesMeta;
}

export type ExpenseStatusCount = {
  status: ExpenseStatus;
  count: number;
};

export type ExpenseStatusCounts = {
  byStatus: ExpenseStatusCount[];
  needsAction: number;
};

export type ExpensePolicyHint = {
  category: ExpenseCategory;
  policyName: string;
  capAmount: number;
  currentSpend: number;
  remainingAmount: number;
  utilizationPercent: number;
};

export type ExpenseDuplicateCheckResult = {
  isDuplicate: boolean;
  message?: string;
};

/** Aggregated queue metrics for approver home screens. */
export interface PendingApprovalSummary {
  currency: string;
  awaitingApprovalCount: number;
  awaitingApprovalAmount: number;
  agingApprovalCount: number;
}

export interface FinanceAgingBucket {
  key: '0_7' | '8_14' | '15_30' | '30_plus';
  label: string;
  count: number;
  totalAmount: number;
}

export interface FinanceRecentlyReimbursed {
  currency: string;
  count: number;
  totalAmount: number;
  windowDays: number;
}

export interface FinanceQueueSummary {
  currency: string;
  approvedCount: number;
  approvedAmount: number;
  oldestApprovedAt?: Date | null;
  agingBuckets: FinanceAgingBucket[];
  recentlyReimbursed: FinanceRecentlyReimbursed;
}

export type BulkReimburseResult = {
  succeeded: Array<{ reference: string }>;
  failed: Array<{ reference: string; reason: string }>;
  partialSuccess: boolean;
  allSucceeded: boolean;
};

export type PayrollExportRow = {
  employeeEmail: string;
  employeeName: string;
  expenseReference: string;
  title: string;
  amountMajor: string;
  currency: string;
  departmentName: string;
  approvedAt: string;
  narration: string;
};
