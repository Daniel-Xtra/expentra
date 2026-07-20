import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  PolicyCondition,
  PolicyEvaluationContext,
} from '../../types/policy.types';
import type { PolicyEvaluationCache } from '../policy-evaluation.cache';
import type { IPolicyFieldResolver } from './policy-field-resolver.interface';
import {
  assertCategoryValue,
  assertIntegerValue,
  assertPositiveKobo,
  assertRequiredParam,
  assertWeekdayValue,
  formatKobo,
} from './field-resolver.utils';
import {
  formatCategoryLabel,
  formatWeekday,
} from './condition-description.utils';

@Injectable()
export class AmountFieldResolver implements IPolicyFieldResolver {
  readonly key = 'amount';
  readonly valueType = 'naira' as const;
  readonly operators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const;

  validateCondition(condition: PolicyCondition, index: number): void {
    assertPositiveKobo(condition, index, 'amount');
  }

  resolve(context: PolicyEvaluationContext): Promise<number> {
    return Promise.resolve(context.amount);
  }

  describe(condition: PolicyCondition): string {
    const amount = formatKobo(Number(condition.value));

    switch (condition.operator) {
      case 'gte':
        return `the expense amount is at least ${amount}`;
      case 'gt':
        return `the expense amount is more than ${amount}`;
      case 'lte':
        return `the expense amount is ${amount} or less`;
      case 'lt':
        return `the expense amount is less than ${amount}`;
      case 'eq':
        return `the expense amount is exactly ${amount}`;
      case 'neq':
        return `the expense amount is not ${amount}`;
      default:
        return `the expense amount is ${amount}`;
    }
  }
}

@Injectable()
export class CategoryFieldResolver implements IPolicyFieldResolver {
  readonly key = 'category';
  readonly valueType = 'category' as const;
  readonly operators = ['eq', 'neq', 'in', 'not_in'] as const;

  validateCondition(condition: PolicyCondition, index: number): void {
    assertCategoryValue(condition, index);
  }

  resolve(context: PolicyEvaluationContext): Promise<string> {
    return Promise.resolve(context.category);
  }

  describe(condition: PolicyCondition): string {
    switch (condition.operator) {
      case 'eq':
        return `the category is ${formatCategoryLabel(String(condition.value))}`;
      case 'neq':
        return `the category is not ${formatCategoryLabel(String(condition.value))}`;
      case 'in': {
        const categories = Array.isArray(condition.value)
          ? condition.value
              .map((item) => formatCategoryLabel(String(item)))
              .join(', ')
          : formatCategoryLabel(String(condition.value));
        return `the category is ${categories}`;
      }
      case 'not_in': {
        const categories = Array.isArray(condition.value)
          ? condition.value
              .map((item) => formatCategoryLabel(String(item)))
              .join(', ')
          : formatCategoryLabel(String(condition.value));
        return `the category is not ${categories}`;
      }
      default:
        return `the category is ${formatCategoryLabel(String(condition.value))}`;
    }
  }
}

@Injectable()
export class AttachmentCountFieldResolver implements IPolicyFieldResolver {
  readonly key = 'attachment_count';
  readonly valueType = 'number' as const;
  readonly operators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const;

  validateCondition(condition: PolicyCondition, index: number): void {
    assertIntegerValue(condition, index);
  }

  resolve(context: PolicyEvaluationContext): Promise<number> {
    return Promise.resolve(context.attachmentCount);
  }

  describe(condition: PolicyCondition): string {
    const count = Number(condition.value);

    switch (condition.operator) {
      case 'eq':
        if (count === 0) {
          return 'no receipts are attached';
        }
        return `exactly ${count} receipt${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} attached`;
      case 'neq':
        if (count === 0) {
          return 'at least one receipt is attached';
        }
        return `the number of receipts is not ${count}`;
      case 'gte':
        if (count <= 1) {
          return 'at least one receipt is required';
        }
        return `at least ${count} receipts are required`;
      case 'gt':
        return `more than ${count} receipt${count === 1 ? '' : 's'} ${count === 0 ? 'are' : 'is'} required`;
      case 'lte':
        if (count === 0) {
          return 'no receipts should be attached';
        }
        return `no more than ${count} receipt${count === 1 ? '' : 's'} should be attached`;
      case 'lt':
        return `fewer than ${count} receipt${count === 1 ? '' : 's'} are attached`;
      default:
        return `the receipt count is ${count}`;
    }
  }
}

@Injectable()
export class SubmittedDayFieldResolver implements IPolicyFieldResolver {
  readonly key = 'submitted_day_of_week';
  readonly valueType = 'weekdays' as const;
  readonly operators = ['eq', 'in', 'not_in'] as const;

  validateCondition(condition: PolicyCondition, index: number): void {
    assertWeekdayValue(condition, index);
  }

  resolve(context: PolicyEvaluationContext): Promise<number> {
    return Promise.resolve(context.submittedAt.getUTCDay());
  }

  describe(condition: PolicyCondition): string {
    switch (condition.operator) {
      case 'eq':
        return `the expense was submitted on ${formatWeekday(Number(condition.value))}`;
      case 'in': {
        const days = Array.isArray(condition.value)
          ? condition.value
              .map((item) => formatWeekday(Number(item)))
              .join(', ')
          : formatWeekday(Number(condition.value));
        return `the expense was submitted on ${days}`;
      }
      case 'not_in': {
        const days = Array.isArray(condition.value)
          ? condition.value
              .map((item) => formatWeekday(Number(item)))
              .join(', ')
          : formatWeekday(Number(condition.value));
        return `the expense was not submitted on ${days}`;
      }
      default:
        return `the expense was submitted on ${formatWeekday(Number(condition.value))}`;
    }
  }
}

@Injectable()
export class MonthlyCategorySpendFieldResolver implements IPolicyFieldResolver {
  readonly key = 'monthly_category_spend';
  readonly valueType = 'naira' as const;
  readonly operators = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;

  validateCondition(condition: PolicyCondition, index: number): void {
    assertRequiredParam(condition, index, 'category');
    assertPositiveKobo(condition, index, 'spend cap');
  }

  resolve(
    context: PolicyEvaluationContext,
    condition: PolicyCondition,
    cache: PolicyEvaluationCache,
  ): Promise<number> {
    return cache.getMonthlyCategorySpend(condition.params!.category!);
  }

  describe(condition: PolicyCondition): string {
    const category = formatCategoryLabel(
      String(condition.params?.category ?? 'this category'),
    );
    const amount = formatKobo(Number(condition.value));

    switch (condition.operator) {
      case 'gte':
        return `${category} monthly spend is at least ${amount}`;
      case 'gt':
        return `${category} monthly spend is more than ${amount}`;
      case 'lte':
        return `${category} monthly spend is ${amount} or less`;
      case 'lt':
        return `${category} monthly spend is less than ${amount}`;
      case 'eq':
        return `${category} monthly spend is exactly ${amount}`;
      default:
        return `${category} monthly spend is ${amount}`;
    }
  }
}

@Injectable()
export class DuplicateExpenseFieldResolver implements IPolicyFieldResolver {
  readonly key = 'has_duplicate_expense';
  readonly valueType = 'boolean' as const;
  readonly operators = ['eq'] as const;

  validateCondition(condition: PolicyCondition, index: number): void {
    if (typeof condition.value !== 'boolean') {
      throw new BadRequestException(
        `Condition ${index + 1} duplicate value must be true or false`,
      );
    }
    assertRequiredParam(condition, index, 'windowDays');
  }

  resolve(
    _context: PolicyEvaluationContext,
    condition: PolicyCondition,
    cache: PolicyEvaluationCache,
  ): Promise<boolean> {
    return cache.hasDuplicateExpense(condition.params!.windowDays!);
  }

  describe(condition: PolicyCondition): string {
    const days = Number(condition.params?.windowDays ?? 0);

    if (condition.value === true) {
      return Number.isFinite(days) && days > 0
        ? `a similar expense was submitted within the last ${days} day${days === 1 ? '' : 's'}`
        : 'a similar expense was submitted recently';
    }

    return Number.isFinite(days) && days > 0
      ? `no similar expense exists within the last ${days} day${days === 1 ? '' : 's'}`
      : 'no similar expense exists recently';
  }
}
