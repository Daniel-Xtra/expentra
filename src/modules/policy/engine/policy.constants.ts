import { ExpenseCategory } from 'src/database/entities/expense.enums';
import type { PolicyConditionOperator } from '../types/policy.types';

export const POLICY_CONDITION_OPERATORS: PolicyConditionOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
];

export const POLICY_OPERATOR_LABELS: Record<PolicyConditionOperator, string> = {
  eq: 'equals',
  neq: 'does not equal',
  gt: 'is greater than',
  gte: 'is greater than or equal to',
  lt: 'is less than',
  lte: 'is less than or equal to',
  in: 'is one of',
  not_in: 'is not one of',
};

export const POLICY_EXPENSE_CATEGORIES = Object.values(ExpenseCategory);

export const POLICY_WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;
