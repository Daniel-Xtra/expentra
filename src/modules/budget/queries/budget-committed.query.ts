import type { EntityManager } from 'typeorm';
import { IsNull } from 'typeorm';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';

const SUM_COMMITTED_SPEND_SQL = `
  SELECT COALESCE(SUM(e.amount), 0)::bigint AS total
  FROM expenses e
  WHERE e.department_id = $1
    AND e.status::text = ANY($2::text[])
    AND e.submitted_at >= $3
    AND e.submitted_at < $4
`;

const SUM_REIMBURSED_SPEND_SQL = `
  SELECT COALESCE(SUM(e.amount), 0)::bigint AS total
  FROM expenses e
  WHERE e.department_id = $1
    AND e.status = $2
    AND e.submitted_at >= $3
    AND e.submitted_at < $4
`;

export async function lockDepartmentBudgetRow(
  manager: EntityManager,
  departmentId: number,
  year: number,
): Promise<DepartmentBudget | null> {
  return manager.getRepository(DepartmentBudget).findOne({
    where: {
      departmentId,
      year,
      isActive: true,
      deletedAt: IsNull(),
    },
    lock: { mode: 'pessimistic_write' },
  });
}

export async function applyCommittedAmountDelta(
  manager: EntityManager,
  departmentId: number,
  year: number,
  deltaAmount: number,
): Promise<void> {
  if (deltaAmount === 0) {
    return;
  }

  await lockDepartmentBudgetRow(manager, departmentId, year);

  await manager.query(
    `
      UPDATE department_budgets
      SET committed_amount = GREATEST(0, committed_amount + $1)
      WHERE department_id = $2
        AND year = $3
        AND is_active = TRUE
        AND deleted_at IS NULL
    `,
    [deltaAmount, departmentId, year],
  );
}

export async function applyReimbursedAmountDelta(
  manager: EntityManager,
  departmentId: number,
  year: number,
  deltaAmount: number,
): Promise<void> {
  if (deltaAmount === 0) {
    return;
  }

  await lockDepartmentBudgetRow(manager, departmentId, year);

  await manager.query(
    `
      UPDATE department_budgets
      SET reimbursed_amount = GREATEST(0, reimbursed_amount + $1)
      WHERE department_id = $2
        AND year = $3
        AND is_active = TRUE
        AND deleted_at IS NULL
    `,
    [deltaAmount, departmentId, year],
  );
}

export async function sumCommittedSpendForDepartmentYear(
  manager: EntityManager,
  departmentId: number,
  periodStart: Date,
  periodEnd: Date,
  committedStatuses: ExpenseStatus[],
): Promise<number> {
  const [row] = await manager.query<Array<{ total: string }>>(
    SUM_COMMITTED_SPEND_SQL,
    [departmentId, committedStatuses, periodStart, periodEnd],
  );

  return parseInt(row?.total ?? '0', 10);
}

export async function sumReimbursedSpendForDepartmentYear(
  manager: EntityManager,
  departmentId: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const [row] = await manager.query<Array<{ total: string }>>(
    SUM_REIMBURSED_SPEND_SQL,
    [departmentId, ExpenseStatus.REIMBURSED, periodStart, periodEnd],
  );

  return parseInt(row?.total ?? '0', 10);
}

export async function recalculateDepartmentBudgetCommitted(
  manager: EntityManager,
  departmentId: number,
  year: number,
  periodStart: Date,
  periodEnd: Date,
  committedStatuses: ExpenseStatus[],
): Promise<void> {
  await lockDepartmentBudgetRow(manager, departmentId, year);

  const [pipelineAmount, reimbursedAmount] = await Promise.all([
    sumCommittedSpendForDepartmentYear(
      manager,
      departmentId,
      periodStart,
      periodEnd,
      committedStatuses,
    ),
    sumReimbursedSpendForDepartmentYear(
      manager,
      departmentId,
      periodStart,
      periodEnd,
    ),
  ]);
  const committedAmount = pipelineAmount + reimbursedAmount;

  await manager
    .getRepository(DepartmentBudget)
    .createQueryBuilder()
    .update(DepartmentBudget)
    .set({ committedAmount })
    .where('department_id = :departmentId', { departmentId })
    .andWhere('year = :year', { year })
    .andWhere('deleted_at IS NULL')
    .execute();
}

export async function recalculateDepartmentBudgetReimbursed(
  manager: EntityManager,
  departmentId: number,
  year: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  await lockDepartmentBudgetRow(manager, departmentId, year);

  const reimbursedAmount = await sumReimbursedSpendForDepartmentYear(
    manager,
    departmentId,
    periodStart,
    periodEnd,
  );

  await manager
    .getRepository(DepartmentBudget)
    .createQueryBuilder()
    .update(DepartmentBudget)
    .set({ reimbursedAmount })
    .where('department_id = :departmentId', { departmentId })
    .andWhere('year = :year', { year })
    .andWhere('deleted_at IS NULL')
    .execute();
}
