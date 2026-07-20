import { Injectable, Logger } from '@nestjs/common';
import type {
  ConditionalPolicyConfig,
  PolicyCondition,
  PolicyConditionOperator,
  PolicyEvaluationContext,
} from '../types/policy.types';
import type { PolicyEvaluationCache } from './policy-evaluation.cache';
import { PolicyFieldResolverRegistry } from './field-resolvers/policy-field-resolver.registry';
import {
  capitalizeFirst,
  joinNaturalLanguage,
} from './field-resolvers/condition-description.utils';

@Injectable()
export class ConditionEvaluator {
  private readonly logger = new Logger(ConditionEvaluator.name);

  constructor(private readonly fieldRegistry: PolicyFieldResolverRegistry) {}

  async isViolated(
    config: ConditionalPolicyConfig,
    context: PolicyEvaluationContext,
    cache: PolicyEvaluationCache,
    options?: { treatUnknownFieldsAsViolated?: boolean },
  ): Promise<boolean> {
    const results = await Promise.all(
      config.conditions.map((condition) =>
        this.evaluateCondition(condition, context, cache, options),
      ),
    );

    return config.match === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  buildDefaultMessage(config: ConditionalPolicyConfig): string {
    const summaries = config.conditions.map((condition) =>
      this.fieldRegistry.describeCondition(condition),
    );

    const joined = joinNaturalLanguage(
      summaries,
      config.match === 'any' ? 'or' : 'and',
    );

    return `${capitalizeFirst(joined)}.`;
  }

  private async evaluateCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext,
    cache: PolicyEvaluationCache,
    options?: { treatUnknownFieldsAsViolated?: boolean },
  ): Promise<boolean> {
    const resolver = this.fieldRegistry.get(condition.field);
    if (!resolver) {
      this.logger.warn(
        `Unknown policy field "${condition.field}" — condition skipped`,
      );
      return options?.treatUnknownFieldsAsViolated === true;
    }

    if (!this.conditionAppliesToExpense(condition, context)) {
      return false;
    }

    const actual = await resolver.resolve(context, condition, cache);
    return this.compare(actual, condition.operator, condition.value);
  }

  private conditionAppliesToExpense(
    condition: PolicyCondition,
    context: PolicyEvaluationContext,
  ): boolean {
    if (condition.field !== 'monthly_category_spend') {
      return true;
    }

    const category = condition.params?.category;
    return category != null && context.category === category;
  }

  private compare(
    actual: unknown,
    operator: PolicyConditionOperator,
    expected: PolicyCondition['value'],
  ): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'neq':
        return actual !== expected;
      case 'gt':
        return Number(actual) > Number(expected);
      case 'gte':
        return Number(actual) >= Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      case 'lte':
        return Number(actual) <= Number(expected);
      case 'in':
        return (
          Array.isArray(expected) &&
          expected.some(
            (item) => item === actual || String(item) === String(actual),
          )
        );
      case 'not_in':
        return (
          Array.isArray(expected) &&
          !expected.some(
            (item) => item === actual || String(item) === String(actual),
          )
        );
      default:
        return false;
    }
  }
}
