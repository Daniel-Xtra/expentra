import type {
  ExpenseCategory,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';

export type DashboardPeriodQuery = {
  year?: number;
  month?: number;
  quarter?: number;
};

export type DashboardActionBucket = {
  count: number;
  totalAmount: number;
};

export type DashboardRecentExpense = {
  reference: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  status: ExpenseStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DashboardPolicyWarning = {
  policyReference: string;
  policyName: string;
  category: ExpenseCategory;
  capAmount: number;
  currentSpend: number;
  utilizationPercent: number;
  message: string;
};

export type DashboardPeriodTrend = {
  previousTotalAmount: number;
  previousExpenseCount: number;
  totalAmountChangePercent: number | null;
  expenseCountChangePercent: number | null;
  label: string;
};

export type DashboardSpendPeriodRow = {
  period: number;
  label: string;
  totalAmount: number;
  expenseCount: number;
  categoryAmounts?: Partial<Record<ExpenseCategory, number>>;
};

export type DashboardReimbursementStats = {
  avgDays: number | null;
  reimbursedCount: number;
};

export type PersonalDashboard = {
  year: number;
  month?: number;
  quarter?: number;
  periodLabel: string;
  currency: string;
  totalAmount: number;
  expenseCount: number;
  pendingReimbursementAmount: number;
  pendingReimbursementCount: number;
  inApprovalAmount: number;
  inApprovalCount: number;
  actionRequired: {
    drafts: DashboardActionBucket;
    rejected: DashboardActionBucket;
  };
  reimbursementStats: DashboardReimbursementStats;
  avgDaysToReimbursement: number | null;
  spendOverTime: DashboardSpendPeriodRow[];
  spendOverTimeGranularity: 'month' | 'week';
  recentExpenses: DashboardRecentExpense[];
  policyWarnings: DashboardPolicyWarning[];
  trend: DashboardPeriodTrend;
};

export type TeamDashboard = {
  year: number;
  month?: number;
  quarter?: number;
  currency: string;
  departmentReference: string;
  departmentName: string;
  teamSpendAmount: number;
  teamExpenseCount: number;
  budgetLimit: number | null;
  committedAmount: number | null;
  remainingAmount: number | null;
  utilizationPercent: number | null;
  projectedUtilizationPercent: number | null;
  pendingApprovals: number;
  agingApprovals: number;
  spendOverTime: DashboardSpendPeriodRow[];
  spendOverTimeGranularity: 'month' | 'week';
};
