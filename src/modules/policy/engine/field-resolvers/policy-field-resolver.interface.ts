import type { PolicyFieldValueType } from 'src/database/entities/policy-condition-field.entity';
import type {
  PolicyCondition,
  PolicyConditionOperator,
  PolicyEvaluationContext,
} from '../../types/policy.types';
import type { PolicyEvaluationCache } from '../policy-evaluation.cache';

export interface IPolicyFieldResolver {
  readonly key: string;
  readonly valueType: PolicyFieldValueType;
  readonly operators: readonly PolicyConditionOperator[];
  validateCondition(condition: PolicyCondition, index: number): void;
  resolve(
    context: PolicyEvaluationContext,
    condition: PolicyCondition,
    cache: PolicyEvaluationCache,
  ): Promise<unknown>;
  describe(condition: PolicyCondition): string;
}
