import type {
  ExpenseCategory,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type { ReportPeriodMode } from '../constants/report-period-mode.enum';
import type { ReportSpendMode } from '../constants/report-spend-mode.enum';

export type SpendingReportQuery = {
  year: number;
  periodMode?: ReportPeriodMode;
  month?: number;
  quarter?: number;
  departmentReference?: string;
  category?: ExpenseCategory;
  includePipeline?: boolean;
  mode?: ReportSpendMode;
};

export type YearlySpendingQuery = {
  year: number;
  departmentReference?: string;
  category?: ExpenseCategory;
  includePipeline?: boolean;
  mode?: ReportSpendMode;
};

export type AgingBucketKey = '0_7' | '8_14' | '15_30' | '30_plus';

export type AgingBucket = {
  key: AgingBucketKey;
  label: string;
  count: number;
  totalAmount: number;
};

export type PendingPayoutSummary = {
  currency: string;
  count: number;
  totalAmount: number;
  oldestApprovedAt: Date | string | null;
  agingBuckets: AgingBucket[];
};

export type ReimbursementSlaSummary = {
  avgDays: number | null;
  reimbursedCount: number;
};

export type PeriodComparisonPoint = {
  year: number;
  month?: number;
  quarter?: number;
  totalAmount: number;
  expenseCount: number;
  amountChangePercent: number | null;
  countChangePercent: number | null;
};

export type SpendComparisonSummary = {
  monthOverMonth: PeriodComparisonPoint;
  yearOverYear: PeriodComparisonPoint;
};

export type PolicyViolationByPolicy = {
  policyReference: string;
  policyName: string | null;
  count: number;
};

export type PolicyViolationSummary = {
  exceptionCount: number;
  expenseCount: number;
  byPolicy: PolicyViolationByPolicy[];
};

export type TopSpenderRow = {
  userReference: string;
  userEmail: string;
  firstName: string | null;
  lastName: string | null;
  departmentName: string | null;
  count: number;
  totalAmount: number;
};

export type MonthlySpendingRow = {
  month: number;
  totalAmount: number;
  expenseCount: number;
  categoryAmounts?: Partial<Record<ExpenseCategory, number>>;
};

export type YearlyMonthlySpendingReport = {
  year: number;
  currency: string;
  months: MonthlySpendingRow[];
};

export type OrganizationBudgetSummary = {
  year: number;
  currency: string;
  amountLimit: number;
  committedAmount: number;
  reimbursedAmount: number;
  remainingAmount: number;
  overBudgetAmount: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  departmentCount: number;
  hasBudget: boolean;
};

export type SpendingSummaryReport = {
  year: number;
  periodMode: ReportPeriodMode;
  month?: number;
  quarter?: number;
  currency: string;
  totalAmount: number;
  expenseCount: number;
  byStatus: Array<{
    status: ExpenseStatus;
    count: number;
    totalAmount: number;
  }>;
  organizationBudget: OrganizationBudgetSummary;
  pendingPayout: PendingPayoutSummary;
  reimbursementSla: ReimbursementSlaSummary;
  comparison: SpendComparisonSummary;
  policyViolations: PolicyViolationSummary;
  topSpenders: TopSpenderRow[];
};

export type CategorySpendingRow = {
  category: string;
  count: number;
  totalAmount: number;
};

export type DepartmentSpendingRow = {
  departmentReference: string;
  departmentName: string;
  departmentCode: string;
  count: number;
  totalAmount: number;
};

export type ExpenseExportRow = {
  expenseReference: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  status: string;
  userReference: string;
  userEmail: string;
  departmentReference: string | null;
  departmentName: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  reimbursedAt: string | null;
};
