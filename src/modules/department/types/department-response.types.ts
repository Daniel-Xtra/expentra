import type { DepartmentResponse } from '../mappers/department-response.mapper';

export type DepartmentListExtras = {
  headcount: number;
  pendingApprovalCount: number;
  hasBudget: boolean;
  utilizationPercent: number | null;
  isOverBudget: boolean;
  isNearLimit: boolean;
};

export type DepartmentExpenseStats = {
  year: number;
  totalCount: number;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  reimbursedCount: number;
  totalAmountYtd: number;
  pendingReimbursementAmount: number;
};

export type DepartmentRecentExpense = {
  reference: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
  submitterName?: string | null;
};

export type DepartmentDetailSummary = {
  department: DepartmentResponse;
  expenseStats: DepartmentExpenseStats;
  recentExpenses: DepartmentRecentExpense[];
};
