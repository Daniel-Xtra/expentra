import type { EntityManager, Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import type { ExpenseStatus } from 'src/database/entities/expense.enums';
import type { BudgetUsageSummary } from '../types/budget.types';
import { sumCommittedSpendForDepartmentYear } from './budget-committed.query';

type BudgetSummaryQueryRow = {
  departmentReference: string;
  departmentName: string;
  departmentCode: string;
  budgetId: number | null;
  budgetReference: string | null;
  budgetDepartmentId: number | null;
  budgetYear: number | null;
  budgetAmountLimit: string | null;
  budgetCurrency: string | null;
  budgetIsActive: boolean | null;
  budgetCreatedAt: Date | null;
  budgetUpdatedAt: Date | null;
  committedAmount: string;
  reimbursedAmount: string;
  amountLimit: string;
  currency: string;
  remainingAmount: string;
  utilizationPercent: string;
  isOverBudget: boolean;
};

const DEPARTMENT_BUDGET_SUMMARY_SQL = `
  SELECT
    d.reference AS "departmentReference",
    d.name AS "departmentName",
    d.code AS "departmentCode",
    b.id AS "budgetId",
    b.reference AS "budgetReference",
    b.department_id AS "budgetDepartmentId",
    b.year AS "budgetYear",
    b.amount_limit::text AS "budgetAmountLimit",
    b.currency AS "budgetCurrency",
    b.is_active AS "budgetIsActive",
    b.created_at AS "budgetCreatedAt",
    b.updated_at AS "budgetUpdatedAt",
    COALESCE(b.committed_amount, 0)::text AS "committedAmount",
    COALESCE(b.reimbursed_amount, 0)::text AS "reimbursedAmount",
    COALESCE(b.amount_limit, 0)::text AS "amountLimit",
    COALESCE(b.currency, 'NGN') AS "currency",
    COALESCE(b.remaining_amount, 0)::text AS "remainingAmount",
    COALESCE(b.utilization_percent, 0)::text AS "utilizationPercent",
    COALESCE(b.is_over_budget, FALSE) AS "isOverBudget"
  FROM departments d
  LEFT JOIN department_budgets b
    ON b.department_id = d.id
    AND b.year = $2
    AND b.is_active = TRUE
    AND b.deleted_at IS NULL
  WHERE d.id = $1
    AND d.deleted_at IS NULL
`;

export type FetchDepartmentBudgetSummaryParams = {
  departmentId: number;
  year: number;
  periodStart: Date;
  periodEnd: Date;
  committedStatuses: ExpenseStatus[];
  nearLimitThresholdPercent: number;
};

function mapBudgetFromSummaryRow(
  row: BudgetSummaryQueryRow,
  department: Department,
): DepartmentBudget | null {
  if (!row.budgetId || !row.budgetReference || row.budgetDepartmentId == null) {
    return null;
  }

  const budget = new DepartmentBudget();
  budget.id = row.budgetId;
  budget.reference = row.budgetReference;
  budget.departmentId = row.budgetDepartmentId;
  budget.year = row.budgetYear!;
  budget.amountLimit = parseInt(row.budgetAmountLimit ?? '0', 10);
  budget.currency = row.budgetCurrency ?? 'NGN';
  budget.isActive = row.budgetIsActive ?? true;
  budget.committedAmount = parseInt(row.committedAmount, 10);
  budget.reimbursedAmount = parseInt(row.reimbursedAmount, 10);
  budget.remainingAmount = parseInt(row.remainingAmount, 10);
  budget.utilizationPercent = parseFloat(row.utilizationPercent);
  budget.isOverBudget = row.isOverBudget;
  budget.createdAt = row.budgetCreatedAt ?? new Date(0);
  budget.updatedAt = row.budgetUpdatedAt ?? new Date(0);
  budget.department = department;
  return budget;
}

export async function fetchDepartmentBudgetSummary(
  departmentRepository: Repository<Department>,
  params: FetchDepartmentBudgetSummaryParams,
  manager?: EntityManager,
): Promise<BudgetUsageSummary | null> {
  const runner = manager ?? departmentRepository.manager;
  const rows = await runner.query<BudgetSummaryQueryRow[]>(
    DEPARTMENT_BUDGET_SUMMARY_SQL,
    [params.departmentId, params.year],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const department = new Department();
  department.reference = row.departmentReference;
  department.name = row.departmentName;
  department.code = row.departmentCode;

  const budget = mapBudgetFromSummaryRow(row, department);

  let committedAmount = parseInt(row.committedAmount, 10);
  let reimbursedAmount = parseInt(row.reimbursedAmount, 10);
  if (!budget) {
    committedAmount = await sumCommittedSpendForDepartmentYear(
      runner,
      params.departmentId,
      params.periodStart,
      params.periodEnd,
      params.committedStatuses,
    );
    reimbursedAmount = 0;
  }

  const amountLimit = parseInt(row.amountLimit, 10);
  const utilizationPercent =
    budget && amountLimit > 0 ? parseFloat(row.utilizationPercent) : 0;
  const isNearLimit =
    budget && amountLimit > 0
      ? utilizationPercent >= params.nearLimitThresholdPercent
      : false;

  return {
    department: {
      reference: row.departmentReference,
      name: row.departmentName,
      code: row.departmentCode,
    },
    year: params.year,
    currency: row.currency,
    amountLimit,
    committedAmount,
    reimbursedAmount,
    remainingAmount: budget ? parseInt(row.remainingAmount, 10) : 0,
    utilizationPercent,
    isOverBudget: budget ? row.isOverBudget : false,
    isNearLimit,
    budget,
  };
}

export function computeProjectedBudgetMetrics(
  amountLimit: number,
  projectedCommittedAmount: number,
  nearLimitThresholdPercent: number,
): Pick<
  BudgetUsageSummary,
  'remainingAmount' | 'utilizationPercent' | 'isOverBudget' | 'isNearLimit'
> {
  const utilizationPercent =
    amountLimit > 0
      ? Math.round((projectedCommittedAmount / amountLimit) * 10000) / 100
      : 0;

  return {
    remainingAmount: Math.max(0, amountLimit - projectedCommittedAmount),
    utilizationPercent,
    isOverBudget: projectedCommittedAmount > amountLimit,
    isNearLimit:
      amountLimit > 0 && utilizationPercent >= nearLimitThresholdPercent,
  };
}
