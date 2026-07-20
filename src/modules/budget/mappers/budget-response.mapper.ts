import type { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import type {
  BudgetDepartmentRef,
  BudgetUsageSummary,
} from '../types/budget.types';

export type { BudgetDepartmentRef } from '../types/budget.types';

export type BudgetResponse = {
  reference: string;
  department: BudgetDepartmentRef | null;
  year: number;
  amountLimit: number;
  committedAmount: number;
  reimbursedAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  currency: string;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BudgetSummaryResponse = {
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
  hasBudget: boolean;
};

export function toBudgetResponse(budget: DepartmentBudget): BudgetResponse {
  return {
    reference: budget.reference,
    department: budget.department
      ? {
          reference: budget.department.reference,
          name: budget.department.name,
          code: budget.department.code,
        }
      : null,
    year: budget.year,
    amountLimit: budget.amountLimit,
    committedAmount: budget.committedAmount,
    reimbursedAmount: budget.reimbursedAmount,
    remainingAmount: budget.remainingAmount,
    utilizationPercent: budget.utilizationPercent,
    isOverBudget: budget.isOverBudget,
    currency: budget.currency,
    isActive: budget.isActive,
    metadata: budget.metadata ?? null,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

export function toBudgetSummaryResponse(
  summary: BudgetUsageSummary,
): BudgetSummaryResponse {
  return {
    department: summary.department,
    year: summary.year,
    currency: summary.currency,
    amountLimit: summary.amountLimit,
    committedAmount: summary.committedAmount,
    reimbursedAmount: summary.reimbursedAmount,
    remainingAmount: summary.remainingAmount,
    utilizationPercent: summary.utilizationPercent,
    isOverBudget: summary.isOverBudget,
    isNearLimit: summary.isNearLimit,
    hasBudget: summary.budget !== null,
  };
}
