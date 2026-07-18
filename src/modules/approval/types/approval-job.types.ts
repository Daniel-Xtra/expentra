import type { WithJobCorrelation } from 'src/core/correlation/job-correlation.types';

export type ApprovalEscalationJobPayload = WithJobCorrelation<{
  expenseId: number;
}>;
