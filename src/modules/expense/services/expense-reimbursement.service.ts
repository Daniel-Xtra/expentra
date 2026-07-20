import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { AccessPolicyService } from 'src/modules/authorization';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from 'src/modules/budget/contracts/budget.contract';
import { toExpenseBudgetSnapshot } from 'src/modules/budget/utils/expense-budget-sync.util';
import type { IAuthUser } from 'src/definition';
import type { BulkReimburseResult } from '../types/expense.types';
import { buildReimbursementReference } from '../utils/expense-detail.util';
import { ExpenseMutationSupport } from './expense-mutation.support';

@Injectable()
export class ExpenseReimbursementService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly accessPolicy: AccessPolicyService,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly mutationSupport: ExpenseMutationSupport,
  ) {}

  async reimburse(authUser: IAuthUser, reference: string): Promise<Expense> {
    this.accessPolicy.assertCanReimburseExpense(authUser);

    const saved = await this.expenseRepository.manager.transaction(
      async (manager) => {
        const expense = await this.mutationSupport.loadExpenseForMutation(
          manager,
          reference,
          { lock: true },
        );

        if (expense.status !== ExpenseStatus.APPROVED) {
          throw new BadRequestException(
            'Only approved expenses can be marked as reimbursed',
          );
        }

        const before = toExpenseBudgetSnapshot(expense);
        const reimbursedAt = new Date();
        expense.status = ExpenseStatus.REIMBURSED;
        expense.reimbursedAt = reimbursedAt;
        expense.reimbursementReference = buildReimbursementReference(
          expense.reference,
          reimbursedAt,
        );

        const savedExpense = await manager.getRepository(Expense).save(expense);
        await this.budgetService.syncCommittedAmountForExpenseTransition(
          manager,
          before,
          toExpenseBudgetSnapshot(savedExpense),
        );

        await this.domainEventPublisher.publish(
          'expense.reimbursed',
          {
            expenseId: savedExpense.id,
            userId: savedExpense.userId,
            financeId: authUser.id,
          },
          {
            manager,
            idempotencyKey: `expense.reimbursed:${savedExpense.id}:${reimbursedAt.toISOString()}`,
          },
        );

        return savedExpense;
      },
    );

    return saved;
  }

  async bulkReimburse(
    authUser: IAuthUser,
    references: string[],
  ): Promise<BulkReimburseResult> {
    this.accessPolicy.assertCanReimburseExpense(authUser);

    const uniqueReferences = [...new Set(references)];
    const succeeded: BulkReimburseResult['succeeded'] = [];
    const failed: BulkReimburseResult['failed'] = [];

    for (const reference of uniqueReferences) {
      try {
        await this.reimburse(authUser, reference);
        succeeded.push({ reference });
      } catch (error: unknown) {
        failed.push({
          reference,
          reason:
            error instanceof Error ? error.message : 'Reimbursement failed',
        });
      }
    }

    return {
      succeeded,
      failed,
      partialSuccess: failed.length > 0 && succeeded.length > 0,
      allSucceeded: failed.length === 0,
    };
  }
}
