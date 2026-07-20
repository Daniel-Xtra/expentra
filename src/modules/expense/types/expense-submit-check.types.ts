import type { BudgetSubmitEvaluation } from 'src/modules/budget/types/budget.types';
import type { PolicyEvaluationResult } from 'src/modules/policy/types/policy.types';

export type ExpenseSubmitCheckResult = {
  policies: PolicyEvaluationResult;
  budget: BudgetSubmitEvaluation;
};
