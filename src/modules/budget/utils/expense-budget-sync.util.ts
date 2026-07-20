import type { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { BUDGET_COMMITTED_STATUSES } from '../constants/budget.constants';

export type ExpenseBudgetSnapshot = {
  userId: number;
  departmentId?: number | null;
  submittedAt?: Date | null;
  status: ExpenseStatus;
  amount: number;
};

export function toExpenseBudgetSnapshot(
  expense: Pick<
    Expense,
    'userId' | 'departmentId' | 'submittedAt' | 'status' | 'amount'
  >,
): ExpenseBudgetSnapshot {
  return {
    userId: expense.userId,
    departmentId: expense.departmentId,
    submittedAt: expense.submittedAt,
    status: expense.status,
    amount: expense.amount,
  };
}

export function countsTowardCommittedBudget(status: ExpenseStatus): boolean {
  return BUDGET_COMMITTED_STATUSES.includes(status);
}

/** Approved expense marked as reimbursed — tracked separately from committed. */
export function isReimbursementTransition(
  before: ExpenseBudgetSnapshot | null | undefined,
  after: ExpenseBudgetSnapshot | null | undefined,
): boolean {
  return (
    before?.status === ExpenseStatus.APPROVED &&
    after?.status === ExpenseStatus.REIMBURSED
  );
}

export function snapshotAffectsCommittedBudget(
  snapshot: ExpenseBudgetSnapshot | null | undefined,
): boolean {
  return (
    snapshot != null &&
    snapshot.submittedAt != null &&
    countsTowardCommittedBudget(snapshot.status)
  );
}

/** True when a change can alter department budget committed totals. */
export function expenseBudgetAttributionChanged(
  before: ExpenseBudgetSnapshot | null | undefined,
  after: ExpenseBudgetSnapshot | null | undefined,
): boolean {
  if (!before || !after) {
    return Boolean(before ?? after);
  }

  const beforeCommitted = countsTowardCommittedBudget(before.status);
  const afterCommitted = countsTowardCommittedBudget(after.status);

  if (!beforeCommitted && !afterCommitted) {
    return false;
  }

  if (beforeCommitted !== afterCommitted) {
    return true;
  }

  if (!before.submittedAt || !after.submittedAt) {
    return true;
  }

  return (
    before.amount !== after.amount ||
    before.departmentId !== after.departmentId ||
    before.userId !== after.userId ||
    before.submittedAt.getTime() !== after.submittedAt.getTime()
  );
}
