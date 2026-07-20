import type { EntityManager } from 'typeorm';
import type { ExpenseStatus } from 'src/database/entities/expense.enums';

const ORGANIZATION_BUDGET_SUMMARY_SQL = `
  WITH budgeted_departments AS (
    SELECT b.department_id, b.amount_limit
    FROM department_budgets b
    INNER JOIN departments d ON d.id = b.department_id
    WHERE b.year = $1
      AND b.is_active = TRUE
      AND b.deleted_at IS NULL
      AND d.deleted_at IS NULL
      AND d.is_active = TRUE
  ),
  expense_totals AS (
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN e.status::text = ANY($2::text[]) THEN e.amount
            ELSE 0
          END
        ),
        0
      )::bigint AS "pipelineAmount",
      COALESCE(
        SUM(
          CASE
            WHEN e.status = $3 THEN e.amount
            ELSE 0
          END
        ),
        0
      )::bigint AS "reimbursedAmount"
    FROM expenses e
    INNER JOIN users u ON u.id = e.user_id
    INNER JOIN budgeted_departments bd
      ON bd.department_id = COALESCE(e.department_id, u.department_id)
    WHERE e.submitted_at IS NOT NULL
      AND e.submitted_at >= $4
      AND e.submitted_at < $5
  )
  SELECT
    (SELECT COUNT(*)::int FROM budgeted_departments) AS "departmentCount",
    (SELECT COALESCE(SUM(amount_limit), 0)::bigint FROM budgeted_departments) AS "amountLimit",
    expense_totals."pipelineAmount",
    expense_totals."reimbursedAmount"
  FROM expense_totals
`;

export type OrganizationBudgetSummaryRow = {
  departmentCount: number;
  amountLimit: string;
  pipelineAmount: string;
  reimbursedAmount: string;
};

export async function fetchOrganizationBudgetSummary(
  manager: EntityManager,
  year: number,
  periodStart: Date,
  periodEnd: Date,
  committedStatuses: ExpenseStatus[],
  reimbursedStatus: ExpenseStatus,
): Promise<OrganizationBudgetSummaryRow> {
  const [row] = await manager.query<OrganizationBudgetSummaryRow[]>(
    ORGANIZATION_BUDGET_SUMMARY_SQL,
    [year, committedStatuses, reimbursedStatus, periodStart, periodEnd],
  );

  return (
    row ?? {
      departmentCount: 0,
      amountLimit: '0',
      pipelineAmount: '0',
      reimbursedAmount: '0',
    }
  );
}
