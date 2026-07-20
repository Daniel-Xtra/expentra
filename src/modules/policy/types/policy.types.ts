import type {
  ExpensePolicyRuleType,
  ExpensePolicySeverity,
} from 'src/database/entities/expense-policy.enums';
import type { ExpenseCategory } from 'src/database/entities/expense.enums';

export type CreateExpensePolicyInput = {
  name: string;
  ruleType: ExpensePolicyRuleType;
  severity: ExpensePolicySeverity;
  config: Record<string, unknown>;
  isActive?: boolean;
};

export type UpdateExpensePolicyInput = {
  name?: string;
  severity?: ExpensePolicySeverity;
  config?: Record<string, unknown>;
  isActive?: boolean;
};

export type PolicyViolation = {
  policyReference: string;
  policyName: string;
  ruleType: ExpensePolicyRuleType;
  severity: ExpensePolicySeverity;
  message: string;
};

export type PolicyEvaluationResult = {
  violations: PolicyViolation[];
  blockingViolations: PolicyViolation[];
  warningViolations: PolicyViolation[];
};

export type PolicyEvaluationContext = {
  expenseId: number;
  userId: number;
  amount: number;
  category: ExpenseCategory;
  submittedAt: Date;
  attachmentCount: number;
  policyJustifications?: Record<string, string>;
};

export type ReceiptRequiredConfig = {
  minAmountKobo: number;
};

export type CategoryMonthlyCapConfig = {
  category: ExpenseCategory;
  capKobo: number;
};

export type WeekendTravelConfig = {
  categories?: ExpenseCategory[];
};

export type DuplicateDetectionConfig = {
  windowDays: number;
};

export type PolicyConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in';

export type PolicyCondition = {
  field: string;
  operator: PolicyConditionOperator;
  value: string | number | boolean | string[];
  params?: {
    category?: ExpenseCategory;
    windowDays?: number;
  };
};

export type ConditionalPolicyConfig = {
  match: 'all' | 'any';
  conditions: PolicyCondition[];
  message?: string;
};
