import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { resolveBudgetYear } from 'src/modules/budget/utils/budget-period.util';
import type { ExpenseDraftMutation } from 'src/modules/authorization';
import type { IAuthUser } from 'src/definition';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import type { PolicyEvaluationContext } from 'src/modules/policy/types/policy.types';

@Injectable()
export class ExpenseMutationSupport {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly configService: ConfigService,
  ) {}

  assertNonEmptyTitle(title: string): void {
    if (!title.trim()) {
      throw new BadRequestException('Expense title cannot be empty');
    }
  }

  assertPositiveAmount(amount: number, label = 'Expense amount'): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        `${label} must be a positive whole number in minor units`,
      );
    }
  }

  assertIncurredAt(incurredAt?: Date | null): void {
    if (!incurredAt) {
      return;
    }

    const timeZone = this.configService.get<string>('BUDGET_TIMEZONE', 'UTC');
    const currentYear = resolveBudgetYear(new Date(), timeZone);
    const incurredYear = resolveBudgetYear(incurredAt, timeZone);

    if (incurredYear < currentYear) {
      throw new BadRequestException(
        'Incurred date cannot be before the current year',
      );
    }
  }

  assertDraftStatus(expense: Expense, action: ExpenseDraftMutation): void {
    if (expense.status === ExpenseStatus.DRAFT) {
      return;
    }

    if (action === 'submit' && expense.status === ExpenseStatus.SUBMITTED) {
      throw new BadRequestException('Expense has already been submitted');
    }

    const verb =
      action === 'delete'
        ? 'deleted'
        : action === 'submit'
          ? 'submitted'
          : 'modified';

    switch (expense.status) {
      case ExpenseStatus.SUBMITTED:
        throw new BadRequestException(
          action === 'delete'
            ? 'Cannot delete an expense that has been submitted for approval'
            : `Only draft expenses can be ${verb}`,
        );
      case ExpenseStatus.APPROVED:
        throw new BadRequestException(
          action === 'delete'
            ? 'Cannot delete an approved expense'
            : `Only draft expenses can be ${verb}`,
        );
      case ExpenseStatus.REJECTED:
        throw new BadRequestException(
          action === 'delete'
            ? 'Cannot delete a rejected expense'
            : `Only draft expenses can be ${verb}`,
        );
      default:
        throw new BadRequestException(`Only draft expenses can be ${verb}`);
    }
  }

  async loadExpenseForMutation(
    manager: EntityManager,
    reference: string,
    options?: { lock?: boolean },
  ): Promise<Expense> {
    const resolved = await findEntityByReference(
      manager.getRepository(Expense),
      reference,
      'Expense not found',
    );
    const expense = await manager.getRepository(Expense).findOne({
      where: { id: resolved.id },
      ...(options?.lock
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  async buildSubmitPolicyContext(
    authUser: IAuthUser,
    draft: Expense,
  ): Promise<PolicyEvaluationContext> {
    const submitAt = draft.submittedAt ?? new Date();
    const attachmentCount = await this.countExpenseAttachments(draft.id);

    return {
      expenseId: draft.id,
      userId: authUser.id,
      amount: draft.amount,
      category: draft.category,
      submittedAt: submitAt,
      attachmentCount,
    };
  }

  private async countExpenseAttachments(expenseId: number): Promise<number> {
    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId },
      relations: { attachments: true },
      select: { id: true },
    });
    return expense?.attachments?.length ?? 0;
  }
}
