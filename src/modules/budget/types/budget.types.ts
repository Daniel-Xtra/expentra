import type { DepartmentBudget } from 'src/database/entities/department-budget.entity';

export type BudgetDepartmentRef = {
  reference: string;
  name: string;
  code: string;
};

export type CreateDepartmentBudgetInput = {
  departmentReference: string;
  year: number;
  amountLimit: number;
  currency?: string;
};

export type UpdateDepartmentBudgetInput = {
  amountLimit?: number;
  isActive?: boolean;
};

export type BudgetListSortField =
  | 'departmentName'
  | 'year'
  | 'amountLimit'
  | 'committedAmount'
  | 'reimbursedAmount'
  | 'remainingAmount'
  | 'utilizationPercent';

export type BudgetListSortOrder = 'ASC' | 'DESC';

export type BudgetHealthFilter = 'over_budget' | 'near_limit' | 'within_limit';

export type ListBudgetsQuery = {
  departmentReference?: string;
  year?: number;
  page?: number;
  limit?: number;
  sortBy?: BudgetListSortField;
  sortOrder?: BudgetListSortOrder;
  healthFilter?: BudgetHealthFilter;
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

export type BudgetByDepartmentRow = {
  departmentReference: string;
  departmentName: string;
  departmentCode: string;
  committedAmount: number;
  amountLimit: number;
  utilizationPercent: number;
  isOverBudget: boolean;
};

export type BudgetUsageSummary = {
  department: BudgetDepartmentRef | null;
  year: number;
  currency: string;
  amountLimit: number;
  committedAmount: number;
  reimbursedAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  budget: DepartmentBudget | null;
};

export type BudgetSubmitEvaluation = {
  allowed: boolean;
  summary: BudgetUsageSummary | null;
  projectedCommittedAmount: number;
  wouldExceed: boolean;
};

/** Approval-time budget check — expense is already in committed spend. */
export type BudgetApproveEvaluation = {
  summary: BudgetUsageSummary | null;
  committedAmount: number;
  wouldExceed: boolean;
};
