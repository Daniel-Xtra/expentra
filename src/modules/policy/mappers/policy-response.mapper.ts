import type { ExpensePolicy } from 'src/database/entities/expense-policy.entity';

export type ExpensePolicyResponse = {
  reference: string;
  name: string;
  ruleType: string;
  severity: string;
  isActive: boolean;
  config: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toExpensePolicyResponse(
  policy: ExpensePolicy,
): ExpensePolicyResponse {
  return {
    reference: policy.reference,
    name: policy.name,
    ruleType: policy.ruleType,
    severity: policy.severity,
    isActive: policy.isActive,
    config: policy.config,
    metadata: policy.metadata ?? null,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}
