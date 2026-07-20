import type { BudgetSubmitEvaluation } from 'src/modules/budget/types/budget.types';

export type ExpenseBudgetCommittedEvent = {
  expenseId: number;
  actorUserId: number;
  departmentId: number;
  budgetEvaluation: BudgetSubmitEvaluation;
};

export const EXPENSE_BUDGET_COMMITTED_EVENT = 'expense.budget_committed';
