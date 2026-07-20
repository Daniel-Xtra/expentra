import type { EntityManager } from 'typeorm';
import { ExpenseStatus } from 'src/database/entities/expense.enums';

export type DepartmentExpenseStatsRow = {
  totalCount: number;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  reimbursedCount: number;
  totalAmountYtd: string;
  pendingReimbursementAmount: string;
};

const DEPARTMENT_EXPENSE_STATS_SQL = `
  SELECT
    COUNT(*)::int AS "totalCount",
    0::int AS "draftCount",
    COUNT(*) FILTER (WHERE e.status::text = ANY($3::text[]))::int AS "pendingCount",
    COUNT(*) FILTER (WHERE e.status = $4)::int AS "approvedCount",
    COUNT(*) FILTER (WHERE e.status = $5)::int AS "rejectedCount",
    COUNT(*) FILTER (WHERE e.status = $6)::int AS "reimbursedCount",
    COALESCE(SUM(e.amount), 0)::text AS "totalAmountYtd",
    COALESCE(
      SUM(
        CASE
          WHEN e.status = $4 THEN e.amount
          ELSE 0
        END
      ),
      0
    )::text AS "pendingReimbursementAmount"
  FROM expenses e
  LEFT JOIN users u ON u.id = e.user_id
  WHERE (e.department_id = $1 OR u.department_id = $1)
    AND e.created_at >= $2
    AND e.status != $7
`;

const PENDING_STATUSES = [ExpenseStatus.SUBMITTED, ExpenseStatus.UNDER_REVIEW];

export async function fetchDepartmentExpenseStats(
  manager: EntityManager,
  departmentId: number,
  yearStart: Date,
): Promise<DepartmentExpenseStatsRow> {
  const [row] = await manager.query<DepartmentExpenseStatsRow[]>(
    DEPARTMENT_EXPENSE_STATS_SQL,
    [
      departmentId,
      yearStart,
      PENDING_STATUSES,
      ExpenseStatus.APPROVED,
      ExpenseStatus.REJECTED,
      ExpenseStatus.REIMBURSED,
      ExpenseStatus.DRAFT,
    ],
  );

  return (
    row ?? {
      totalCount: 0,
      draftCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      reimbursedCount: 0,
      totalAmountYtd: '0',
      pendingReimbursementAmount: '0',
    }
  );
}
