import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import { User } from 'src/database/entities/user.entity';
import { AccessPolicyService } from 'src/modules/authorization';
import { ApprovalLevelCatalogService } from 'src/modules/approval/services/approval-level-catalog.service';
import { ApprovalRoutingService } from 'src/modules/approval/services/approval-routing.service';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from 'src/modules/budget/contracts/budget.contract';
import { toExpenseBudgetSnapshot } from 'src/modules/budget/utils/expense-budget-sync.util';
import {
  EXPENSE_POLICY_SERVICE,
  type IExpensePolicyService,
} from 'src/modules/policy/contracts/policy.contract';
import type { PolicyEvaluationResult } from 'src/modules/policy/types/policy.types';
import type { IAuthUser } from 'src/definition';
import {
  EXPENSE_BUDGET_COMMITTED_EVENT,
  type ExpenseBudgetCommittedEvent,
} from '../events/expense-budget.events';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
} from '../types/expense.types';
import { ExpenseMutationSupport } from './expense-mutation.support';
import { ExpenseQueryService } from './expense-query.service';

@Injectable()
export class ExpenseDraftService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly accessPolicy: AccessPolicyService,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly mutationSupport: ExpenseMutationSupport,
    private readonly expenseQueryService: ExpenseQueryService,
  ) {}

  async create(userId: number, input: CreateExpenseInput): Promise<Expense> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, departmentId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.departmentId) {
      throw new BadRequestException(
        'You must be assigned to a department before creating expenses',
      );
    }

    const title = input.title.trim();
    this.mutationSupport.assertNonEmptyTitle(title);
    this.mutationSupport.assertPositiveAmount(input.amount);
    const incurredAt = input.incurredAt
      ? new Date(input.incurredAt)
      : undefined;
    this.mutationSupport.assertIncurredAt(incurredAt);

    const expense = this.expenseRepository.create({
      userId,
      departmentId: user.departmentId,
      title,
      description: input.description?.trim() || undefined,
      amount: input.amount,
      currency: 'NGN',
      category: input.category,
      status: ExpenseStatus.DRAFT,
      incurredAt,
    });

    return this.expenseRepository.save(expense);
  }

  async update(
    authUser: IAuthUser,
    reference: string,
    input: UpdateExpenseInput,
  ): Promise<Expense> {
    if (!this.hasUpdateFields(input)) {
      throw new BadRequestException(
        'At least one field must be provided to update an expense',
      );
    }

    await this.expenseQueryService.findOne(authUser, reference);

    return this.expenseRepository.manager.transaction(async (manager) => {
      const expense = await this.mutationSupport.loadExpenseForMutation(
        manager,
        reference,
        { lock: true },
      );

      this.accessPolicy.assertCanMutateExpenseDraft(
        authUser,
        expense,
        'modify',
      );
      this.mutationSupport.assertDraftStatus(expense, 'modify');

      const before = toExpenseBudgetSnapshot(expense);

      if (input.title !== undefined) {
        const title = input.title.trim();
        this.mutationSupport.assertNonEmptyTitle(title);
        expense.title = title;
      }
      if (input.description !== undefined) {
        expense.description = input.description.trim() || undefined;
      }
      if (input.amount !== undefined) {
        this.mutationSupport.assertPositiveAmount(input.amount);
        expense.amount = input.amount;
      }
      if (input.category !== undefined) {
        expense.category = input.category;
      }
      if (input.incurredAt !== undefined) {
        const incurredAt = input.incurredAt
          ? new Date(input.incurredAt)
          : undefined;
        this.mutationSupport.assertIncurredAt(incurredAt);
        expense.incurredAt = incurredAt;
      }

      const saved = await manager.getRepository(Expense).save(expense);
      await this.budgetService.syncCommittedAmountForExpenseTransition(
        manager,
        before,
        toExpenseBudgetSnapshot(saved),
      );
      return saved;
    });
  }

  async remove(authUser: IAuthUser, reference: string): Promise<void> {
    await this.expenseQueryService.findOne(authUser, reference);

    await this.expenseRepository.manager.transaction(async (manager) => {
      const expense = await this.mutationSupport.loadExpenseForMutation(
        manager,
        reference,
        { lock: true },
      );

      this.accessPolicy.assertCanMutateExpenseDraft(
        authUser,
        expense,
        'delete',
      );
      this.mutationSupport.assertDraftStatus(expense, 'delete');

      const { affected } = await manager
        .getRepository(Expense)
        .delete({ id: expense.id });

      if (!affected) {
        throw new NotFoundException('Expense not found');
      }
    });
  }

  async reopenRejected(
    authUser: IAuthUser,
    reference: string,
  ): Promise<Expense> {
    const expense = await this.expenseQueryService.findOne(authUser, reference);

    if (expense.userId !== authUser.id) {
      throw new ForbiddenException('You can only reopen your own expenses');
    }
    if (expense.status !== ExpenseStatus.REJECTED) {
      throw new BadRequestException('Only rejected expenses can be reopened');
    }

    const saved = await this.expenseRepository.manager.transaction(
      async (manager) => {
        const locked = await this.mutationSupport.loadExpenseForMutation(
          manager,
          reference,
          { lock: true },
        );

        if (locked.status !== ExpenseStatus.REJECTED) {
          throw new BadRequestException(
            'Only rejected expenses can be reopened',
          );
        }

        locked.status = ExpenseStatus.DRAFT;
        locked.submittedAt = undefined;
        locked.rejectedAt = undefined;
        locked.approvedAt = undefined;
        locked.reimbursedAt = undefined;

        await manager.getRepository(ExpenseApproval).delete({
          expenseId: locked.id,
        });

        const saved = await manager.getRepository(Expense).save(locked);

        await this.domainEventPublisher.publish(
          'expense.reopened',
          {
            expenseId: saved.id,
            userId: authUser.id,
          },
          { manager },
        );

        return saved;
      },
    );

    return saved;
  }

  private hasUpdateFields(input: UpdateExpenseInput): boolean {
    return (
      input.title !== undefined ||
      input.description !== undefined ||
      input.amount !== undefined ||
      input.category !== undefined ||
      input.incurredAt !== undefined
    );
  }
}
