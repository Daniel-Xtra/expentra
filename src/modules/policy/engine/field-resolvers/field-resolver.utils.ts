import { BadRequestException } from '@nestjs/common';
import { ExpenseCategory } from 'src/database/entities/expense.enums';
import type { PolicyCondition } from '../../types/policy.types';

export function assertPositiveKobo(
  condition: PolicyCondition,
  index: number,
  label: string,
): void {
  if (!Number.isInteger(condition.value) || Number(condition.value) <= 0) {
    throw new BadRequestException(
      `Condition ${index + 1} ${label} must be a positive amount in kobo`,
    );
  }
}

export function assertIntegerValue(
  condition: PolicyCondition,
  index: number,
): void {
  if (!Number.isInteger(condition.value)) {
    throw new BadRequestException(
      `Condition ${index + 1} requires a numeric value`,
    );
  }
}

export function assertCategoryValue(
  condition: PolicyCondition,
  index: number,
): void {
  if (condition.operator === 'in' || condition.operator === 'not_in') {
    if (
      !Array.isArray(condition.value) ||
      condition.value.length === 0 ||
      !condition.value.every(
        (item) =>
          typeof item === 'string' &&
          Object.values(ExpenseCategory).includes(item as ExpenseCategory),
      )
    ) {
      throw new BadRequestException(
        `Condition ${index + 1} category list is invalid`,
      );
    }
    return;
  }

  if (
    typeof condition.value !== 'string' ||
    !Object.values(ExpenseCategory).includes(condition.value as ExpenseCategory)
  ) {
    throw new BadRequestException(
      `Condition ${index + 1} category value is invalid`,
    );
  }
}

export function assertWeekdayValue(
  condition: PolicyCondition,
  index: number,
): void {
  if (condition.operator === 'in' || condition.operator === 'not_in') {
    if (
      !Array.isArray(condition.value) ||
      condition.value.length === 0 ||
      !condition.value.every((item) => Number.isInteger(Number(item)))
    ) {
      throw new BadRequestException(
        `Condition ${index + 1} weekday list is invalid`,
      );
    }
    return;
  }

  if (!Number.isInteger(condition.value)) {
    throw new BadRequestException(
      `Condition ${index + 1} requires a numeric weekday`,
    );
  }
}

export function assertRequiredParam(
  condition: PolicyCondition,
  index: number,
  param: 'category' | 'windowDays',
): void {
  if (param === 'category' && !condition.params?.category) {
    throw new BadRequestException(
      `Condition ${index + 1} requires a category param`,
    );
  }

  if (param === 'windowDays') {
    const windowDays = Number(condition.params?.windowDays);
    if (!Number.isInteger(windowDays) || windowDays <= 0) {
      throw new BadRequestException(
        `Condition ${index + 1} requires a positive windowDays param`,
      );
    }
  }
}

export function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toFixed(2)}`;
}
