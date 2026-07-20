import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import {
  ExpenseCategory,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type { PolicyEvaluationContext } from '../types/policy.types';

const ACTIVE_EXPENSE_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
  ExpenseStatus.APPROVED,
  ExpenseStatus.REIMBURSED,
];

@Injectable()
export class PolicyEvaluationCacheFactory {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  create(context: PolicyEvaluationContext): PolicyEvaluationCache {
    return new PolicyEvaluationCache(this.expenseRepository, context);
  }
}

export class PolicyEvaluationCache {
  private readonly monthlySpendByCategory = new Map<
    ExpenseCategory,
    Promise<number>
  >();
  private readonly duplicateByWindowDays = new Map<number, Promise<boolean>>();

  constructor(
    private readonly expenseRepository: Repository<Expense>,
    private readonly context: PolicyEvaluationContext,
  ) {}

  getMonthlyCategorySpend(category: ExpenseCategory): Promise<number> {
    if (!this.monthlySpendByCategory.has(category)) {
      this.monthlySpendByCategory.set(
        category,
        this.loadMonthlyCategorySpend(category),
      );
    }
    return this.monthlySpendByCategory.get(category)!;
  }

  hasDuplicateExpense(windowDays: number): Promise<boolean> {
    if (!this.duplicateByWindowDays.has(windowDays)) {
      this.duplicateByWindowDays.set(
        windowDays,
        this.loadDuplicateExpense(windowDays),
      );
    }
    return this.duplicateByWindowDays.get(windowDays)!;
  }

  private async loadMonthlyCategorySpend(
    category: ExpenseCategory,
  ): Promise<number> {
    const { start, end } = this.monthRange(this.context.submittedAt);
    const existing = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.user_id = :userId', { userId: this.context.userId })
      .andWhere('expense.category = :category', { category })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: ACTIVE_EXPENSE_STATUSES,
      })
      .andWhere('expense.submitted_at >= :start', { start })
      .andWhere('expense.submitted_at < :end', { end })
      .andWhere('expense.id != :expenseId', {
        expenseId: this.context.expenseId,
      })
      .getRawOne<{ total: string }>();

    const priorTotal = parseInt(existing?.total ?? '0', 10);
    return (
      priorTotal +
      (this.context.category === category ? this.context.amount : 0)
    );
  }

  private async loadDuplicateExpense(windowDays: number): Promise<boolean> {
    const since = new Date(this.context.submittedAt);
    since.setUTCDate(since.getUTCDate() - windowDays);

    const duplicate = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.user_id = :userId', { userId: this.context.userId })
      .andWhere('expense.amount = :amount', { amount: this.context.amount })
      .andWhere('expense.category = :category', {
        category: this.context.category,
      })
      .andWhere('expense.status != :draft', { draft: ExpenseStatus.DRAFT })
      .andWhere('expense.status != :rejected', {
        rejected: ExpenseStatus.REJECTED,
      })
      .andWhere('expense.id != :expenseId', {
        expenseId: this.context.expenseId,
      })
      .andWhere('expense.submitted_at >= :since', { since })
      .getOne();

    return Boolean(duplicate);
  }

  private monthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
    );
    return { start, end };
  }
}
