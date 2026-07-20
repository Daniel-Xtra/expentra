import { toBudgetSummaryResponse } from 'src/modules/budget/mappers/budget-response.mapper';
import type { BudgetSubmitEvaluation } from 'src/modules/budget/types/budget.types';
import { toPolicyEvaluationResponse } from 'src/modules/policy/mappers/policy-evaluation-response.mapper';
import type { ExpenseSubmitCheckResult } from '../types/expense-submit-check.types';

export function toBudgetSubmitCheckResponse(
  evaluation: BudgetSubmitEvaluation,
) {
  return {
    allowed: evaluation.allowed,
    wouldExceed: evaluation.wouldExceed,
    projectedCommittedAmount: evaluation.projectedCommittedAmount,
    summary: evaluation.summary
      ? toBudgetSummaryResponse(evaluation.summary)
      : null,
  };
}

export function toExpenseSubmitCheckResponse(result: ExpenseSubmitCheckResult) {
  return {
    ...toPolicyEvaluationResponse(result.policies),
    budget: toBudgetSubmitCheckResponse(result.budget),
  };
}
