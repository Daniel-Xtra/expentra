import { BadRequestException, Injectable } from '@nestjs/common';
import { ExpenseCategory } from 'src/database/entities/expense.enums';
import { ExpensePolicyRuleType } from 'src/database/entities/expense-policy.enums';
import type {
  CategoryMonthlyCapConfig,
  ConditionalPolicyConfig,
  DuplicateDetectionConfig,
  PolicyCondition,
  ReceiptRequiredConfig,
  WeekendTravelConfig,
} from '../types/policy.types';
import { POLICY_CONDITION_OPERATORS } from './policy.constants';
import { PolicyFieldResolverRegistry } from './field-resolvers/policy-field-resolver.registry';

@Injectable()
export class PolicyConfigValidator {
  constructor(private readonly fieldRegistry: PolicyFieldResolverRegistry) {}

  validate(config: Record<string, unknown>): ConditionalPolicyConfig {
    this.assertOptionalMessage(config);

    const match = config.match;
    if (match !== 'all' && match !== 'any') {
      throw new BadRequestException('Policy match mode must be "all" or "any"');
    }

    if (!Array.isArray(config.conditions) || config.conditions.length === 0) {
      throw new BadRequestException('Policy requires at least one condition');
    }

    const conditions = config.conditions.map((item, index) =>
      this.parseCondition(item, index),
    );

    return { match, conditions };
  }

  normalizeRuleConfig(
    ruleType: ExpensePolicyRuleType,
    config: Record<string, unknown>,
  ): ConditionalPolicyConfig {
    if (ruleType === ExpensePolicyRuleType.CONDITIONAL) {
      return this.validate(config);
    }

    const normalized = this.legacyToConditional(ruleType, config);
    return this.validate(normalized);
  }

  private legacyToConditional(
    ruleType: ExpensePolicyRuleType,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const message =
      typeof config.message === 'string' ? config.message : undefined;

    switch (ruleType) {
      case ExpensePolicyRuleType.RECEIPT_REQUIRED: {
        const typed = config as ReceiptRequiredConfig;
        return {
          match: 'all',
          message,
          conditions: [
            { field: 'amount', operator: 'gte', value: typed.minAmountKobo },
            { field: 'attachment_count', operator: 'eq', value: 0 },
          ],
        };
      }
      case ExpensePolicyRuleType.CATEGORY_MONTHLY_CAP: {
        const typed = config as CategoryMonthlyCapConfig;
        return {
          match: 'all',
          message,
          conditions: [
            { field: 'category', operator: 'eq', value: typed.category },
            {
              field: 'monthly_category_spend',
              operator: 'gt',
              value: typed.capKobo,
              params: { category: typed.category },
            },
          ],
        };
      }
      case ExpensePolicyRuleType.WEEKEND_TRAVEL_JUSTIFICATION: {
        const typed = config as WeekendTravelConfig;
        const categories = typed.categories ?? [ExpenseCategory.TRAVEL];
        return {
          match: 'all',
          message,
          conditions: [
            { field: 'category', operator: 'in', value: categories },
            { field: 'submitted_day_of_week', operator: 'in', value: [0, 6] },
          ],
        };
      }
      case ExpensePolicyRuleType.DUPLICATE_DETECTION: {
        const typed = config as DuplicateDetectionConfig;
        return {
          match: 'all',
          message,
          conditions: [
            {
              field: 'has_duplicate_expense',
              operator: 'eq',
              value: true,
              params: { windowDays: typed.windowDays },
            },
          ],
        };
      }
      default:
        throw new BadRequestException(
          `Unsupported policy rule type: ${ruleType}`,
        );
    }
  }

  private parseCondition(value: unknown, index: number): PolicyCondition {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`Condition ${index + 1} must be an object`);
    }

    const raw = value as Record<string, unknown>;
    const field = raw.field;
    const operator = raw.operator;

    if (typeof field !== 'string') {
      throw new BadRequestException(
        `Condition ${index + 1} has an invalid field`,
      );
    }

    if (
      typeof operator !== 'string' ||
      !POLICY_CONDITION_OPERATORS.includes(
        operator as PolicyCondition['operator'],
      )
    ) {
      throw new BadRequestException(
        `Condition ${index + 1} has an invalid operator`,
      );
    }

    if (raw.value === undefined) {
      throw new BadRequestException(`Condition ${index + 1} requires a value`);
    }

    const condition: PolicyCondition = {
      field,
      operator: operator as PolicyCondition['operator'],
      value: raw.value as PolicyCondition['value'],
    };

    if (raw.params !== undefined) {
      if (!raw.params || typeof raw.params !== 'object') {
        throw new BadRequestException(
          `Condition ${index + 1} params must be an object`,
        );
      }
      const params = raw.params as Record<string, unknown>;
      condition.params = {};
      if (params.category !== undefined) {
        condition.params.category = String(params.category) as ExpenseCategory;
      }
      if (params.windowDays !== undefined) {
        condition.params.windowDays = Number(params.windowDays);
      }
    }

    this.fieldRegistry.validateCondition(condition, index);
    return condition;
  }

  private assertOptionalMessage(config: Record<string, unknown>): void {
    if (
      config.message !== undefined &&
      (typeof config.message !== 'string' || !config.message.trim())
    ) {
      throw new BadRequestException(
        'Policy message must be a non-empty string when provided',
      );
    }
  }
}
