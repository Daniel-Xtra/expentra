import type { EntityManager } from 'typeorm';

export type BudgetByDepartmentRowRaw = {
  departmentReference: string;
  departmentName: string;
  departmentCode: string;
  committedAmount: string;
  amountLimit: string;
  utilizationPercent: string;
  isOverBudget: boolean;
};

const BUDGET_BY_DEPARTMENT_SQL = `
  SELECT
    d.reference AS "departmentReference",
    d.name AS "departmentName",
    d.code AS "departmentCode",
    b.committed_amount::text AS "committedAmount",
    b.amount_limit::text AS "amountLimit",
    b.utilization_percent::text AS "utilizationPercent",
    b.is_over_budget AS "isOverBudget"
  FROM department_budgets b
  INNER JOIN departments d ON d.id = b.department_id
  WHERE b.year = $1
    AND b.is_active = TRUE
    AND b.deleted_at IS NULL
    AND d.deleted_at IS NULL
    AND d.is_active = TRUE
  ORDER BY b.committed_amount DESC
  LIMIT $2
`;

export async function fetchCommittedByDepartment(
  manager: EntityManager,
  year: number,
  limit = 12,
): Promise<BudgetByDepartmentRowRaw[]> {
  return manager.query<BudgetByDepartmentRowRaw[]>(BUDGET_BY_DEPARTMENT_SQL, [
    year,
    limit,
  ]);
}
