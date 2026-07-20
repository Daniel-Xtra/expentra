import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { Department } from 'src/database/entities/department.entity';
import { Expense } from 'src/database/entities/expense.entity';
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
import type { ExpenseSubmitCheckResult } from '../types/expense-submit-check.types';
import type { IAuthUser } from 'src/definition';
import { EXPENSE_BUDGET_COMMITTED_EVENT } from '../events/expense-budget.events';
import { ExpenseMutationSupport } from './expense-mutation.support';
import { ExpenseQueryService } from './expense-query.service';

@Injectable()
export class ExpenseSubmitService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly accessPolicy: AccessPolicyService,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly approvalRouting: ApprovalRoutingService,
    private readonly approvalLevelCatalog: ApprovalLevelCatalogService,
    @Inject(EXPENSE_POLICY_SERVICE)
    private readonly policyService: IExpensePolicyService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly mutationSupport: ExpenseMutationSupport,
    private readonly expenseQueryService: ExpenseQueryService,
  ) {}

  async checkSubmitPolicies(
    authUser: IAuthUser,
    reference: string,
  ): Promise<ExpenseSubmitCheckResult> {
    const draft = await this.expenseQueryService.findOne(authUser, reference);

    this.accessPolicy.assertCanMutateExpenseDraft(authUser, draft, 'submit', {
      ownerOnly: true,
    });
    this.mutationSupport.assertDraftStatus(draft, 'submit');
    this.mutationSupport.assertNonEmptyTitle(draft.title);
    this.mutationSupport.assertPositiveAmount(draft.amount);
    this.mutationSupport.assertIncurredAt(draft.incurredAt);

    const context = await this.mutationSupport.buildSubmitPolicyContext(
      authUser,
      draft,
    );
    const policies = await this.policyService.evaluate(context);
    const budget = await this.budgetService.evaluateExpenseSubmit(
      authUser.id,
      draft.amount,
      draft.incurredAt ?? new Date(),
      draft.departmentId,
    );

    return { policies, budget };
  }

  async submit(
    authUser: IAuthUser,
    reference: string,
    options?: { policyJustifications?: Record<string, string> },
  ): Promise<Expense> {
    const draft = await this.expenseQueryService.findOne(authUser, reference);

    this.accessPolicy.assertCanMutateExpenseDraft(authUser, draft, 'submit', {
      ownerOnly: true,
    });
    this.mutationSupport.assertDraftStatus(draft, 'submit');
    this.mutationSupport.assertNonEmptyTitle(draft.title);
    this.mutationSupport.assertPositiveAmount(draft.amount);
    this.mutationSupport.assertIncurredAt(draft.incurredAt);

    const context = await this.mutationSupport.buildSubmitPolicyContext(
      authUser,
      draft,
    );
    context.policyJustifications = options?.policyJustifications;

    await this.policyService.assertCompliant(context);

    const submitAt = context.submittedAt;

    const saved = await this.expenseRepository.manager.transaction(
      async (manager) => {
        const expense = await this.mutationSupport.loadExpenseForMutation(
          manager,
          reference,
          { lock: true },
        );

        this.accessPolicy.assertCanMutateExpenseDraft(
          authUser,
          expense,
          'submit',
          { ownerOnly: true },
        );
        this.mutationSupport.assertDraftStatus(expense, 'submit');
        this.mutationSupport.assertNonEmptyTitle(expense.title);
        this.mutationSupport.assertPositiveAmount(expense.amount);
        this.mutationSupport.assertIncurredAt(expense.incurredAt);

        const approvalLevels =
          await this.approvalLevelCatalog.getActiveLevels(manager);

        if (!expense.departmentId) {
          const owner = await manager.getRepository(User).findOne({
            where: { id: expense.userId },
            select: { id: true, departmentId: true },
          });
          if (!owner?.departmentId) {
            throw new BadRequestException(
              'You must be assigned to a department before submitting expenses',
            );
          }
          expense.departmentId = owner.departmentId;
        }

        const department = await manager.getRepository(Department).findOne({
          where: { id: expense.departmentId, isActive: true },
          select: { id: true, managerId: true },
        });
        if (department) {
          expense.department = department;
        }

        const requiresDepartmentManager = approvalLevels.some(
          (level) =>
            level.isActive &&
            level.approverType === ApprovalApproverType.DEPARTMENT_MANAGER,
        );
        if (
          requiresDepartmentManager &&
          !this.approvalRouting.shouldSkipDepartmentManagerStage(expense) &&
          !department?.managerId
        ) {
          throw new BadRequestException(
            'Your department must have an assigned manager before expenses can be submitted for approval',
          );
        }

        const needsApproval = this.approvalRouting.requiresApprovalChain(
          expense,
          approvalLevels,
        );

        const budgetCheck =
          await this.budgetService.evaluateExpenseSubmitInTransaction(
            manager,
            authUser.id,
            expense.amount,
            submitAt,
            expense.departmentId,
          );
        if (!budgetCheck.allowed) {
          throw new BadRequestException(
            'Submitting this expense would exceed your department annual budget',
          );
        }

        const before = toExpenseBudgetSnapshot(expense);

        expense.submittedAt = submitAt;
        expense.rejectedAt = undefined;
        expense.reimbursedAt = undefined;

        if (needsApproval) {
          expense.status = this.approvalRouting.resolveInitialSubmitStatus(
            expense,
            approvalLevels,
          );
          expense.approvedAt =
            expense.status === ExpenseStatus.APPROVED ? submitAt : undefined;
        } else {
          expense.status = ExpenseStatus.APPROVED;
          expense.approvedAt = submitAt;
        }

        const persisted = await manager.getRepository(Expense).save(expense);
        await this.budgetService.syncCommittedAmountForExpenseTransition(
          manager,
          before,
          toExpenseBudgetSnapshot(persisted),
        );

        const expenseEventPayload = {
          expenseId: persisted.id,
          userId: persisted.userId,
          policyJustifications: options?.policyJustifications,
        };

        if (persisted.status === ExpenseStatus.APPROVED) {
          await this.domainEventPublisher.publish(
            'expense.approved',
            {
              ...expenseEventPayload,
              approverId: authUser.id,
            },
            {
              manager,
              idempotencyKey: `expense.approved:${persisted.id}:${submitAt.toISOString()}`,
            },
          );
        } else {
          await this.domainEventPublisher.publish(
            'expense.submitted',
            expenseEventPayload,
            {
              manager,
              idempotencyKey: `expense.submitted:${persisted.id}:${submitAt.toISOString()}`,
            },
          );
          if (persisted.status === ExpenseStatus.UNDER_REVIEW) {
            await this.domainEventPublisher.publish(
              'expense.pending_finance',
              {
                expenseId: persisted.id,
                userId: persisted.userId,
                approverId: authUser.id,
              },
              {
                manager,
                idempotencyKey: `expense.pending_finance:${persisted.id}:${submitAt.toISOString()}`,
              },
            );
          }
        }

        if (budgetCheck.summary?.budget?.departmentId) {
          await this.domainEventPublisher.publish(
            EXPENSE_BUDGET_COMMITTED_EVENT,
            {
              expenseId: persisted.id,
              actorUserId: authUser.id,
              departmentId: budgetCheck.summary.budget.departmentId,
              budgetEvaluation: budgetCheck,
            },
            {
              manager,
              idempotencyKey: `expense.budget_committed:${persisted.id}:${submitAt.toISOString()}`,
            },
          );
        }

        return { expense: persisted, budgetCheck };
      },
    );

    const { expense } = saved;
    return expense;
  }
}
