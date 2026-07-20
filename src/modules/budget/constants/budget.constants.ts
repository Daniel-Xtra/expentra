import { ExpenseStatus } from 'src/database/entities/expense.enums';

/** Expense statuses that count against the department annual budget. */
export const BUDGET_COMMITTED_STATUSES: ExpenseStatus[] = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
  ExpenseStatus.APPROVED,
];
