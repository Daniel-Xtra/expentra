import type { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import type {
  CreateExpensePolicyInput,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  UpdateExpensePolicyInput,
} from '../types/policy.types';

export const EXPENSE_POLICY_SERVICE = Symbol('EXPENSE_POLICY_SERVICE');

export interface IExpensePolicyService {
  create(input: CreateExpensePolicyInput): Promise<ExpensePolicy>;
  findAll(): Promise<ExpensePolicy[]>;
  findOne(reference: string): Promise<ExpensePolicy>;
  update(
    reference: string,
    input: UpdateExpensePolicyInput,
  ): Promise<ExpensePolicy>;
  remove(reference: string): Promise<void>;
  evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult>;
  assertCompliant(
    context: PolicyEvaluationContext,
  ): Promise<PolicyEvaluationResult>;
}
