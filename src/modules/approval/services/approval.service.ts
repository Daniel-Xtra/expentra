import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { AccessPolicyService } from 'src/modules/authorization';
import { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import { ExpenseComment } from 'src/database/entities/expense-comment.entity';
import { Expense } from 'src/database/entities/expense.entity';
import {
  ApprovalDecision,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import type { IAuthUser } from 'src/definition';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { parsePositiveIntId } from 'src/core/utils/helper';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from 'src/modules/budget/contracts/budget.contract';
import { toExpenseBudgetSnapshot } from 'src/modules/budget/utils/expense-budget-sync.util';
import type { IApprovalService } from '../contracts/approval.contract';
import type {
  ApproveExpenseInput,
  RejectExpenseInput,
} from '../types/approval.types';
import type { BulkApprovalResult } from '../types/bulk-approval.types';
import { ApprovalLevelCatalogService } from './approval-level-catalog.service';
import { ApprovalRoutingService } from './approval-routing.service';
import { DelegationService } from './delegation.service';

@Injectable()
export class ApprovalService implements IApprovalService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly accessPolicy: AccessPolicyService,
    private readonly routing: ApprovalRoutingService,
    private readonly approvalLevelCatalog: ApprovalLevelCatalogService,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly delegationService: DelegationService,
  ) {}

  async approve(
    authUser: IAuthUser,
    expenseId: number,
    input: ApproveExpenseInput,
  ): Promise<ExpenseApproval> {
    const normalizedId = this.normalizeExpenseId(expenseId);
    const comment = input.comment?.trim() || undefined;

    const saved = await this.expenseRepository.manager.transaction(
      async (manager) => {
        const expense = await this.loadExpenseForDecision(
          manager,
          normalizedId,
          authUser,
        );
        const approvalLevels =
          await this.approvalLevelCatalog.getActiveLevels(manager);
        const existingApprovals = await manager
          .getRepository(ExpenseApproval)
          .find({
            where: { expenseId: expense.id },
            relations: { approvalLevel: true },
          });
        const stage = this.routing.getActiveStage(
          expense,
          approvalLevels,
          existingApprovals,
        );
        if (!stage) {
          const healed = await this.healExpenseWithNoApprovalChain(
            manager,
            expense,
            approvalLevels,
          );
          if (healed) {
            throw new ConflictException(
              'This expense has no approval stages configured and was marked approved',
            );
          }
          throw new ConflictException('This expense is not awaiting approval');
        }

        this.routing.assertReadyForStageApproval(
          stage,
          expense,
          approvalLevels,
          existingApprovals,
        );
        await this.assertCanActOnStage(authUser, stage, expense);

        const budgetCheck = await this.assertOverBudgetApprovalAllowed(
          expense,
          stage,
          comment,
          input.overBudgetAcknowledged,
        );

        await this.assertNoDecisionAtLevel(manager, expense.id, stage);

        const decidedAt = new Date();
        const approval = await this.persistApprovalDecision(manager, {
          expenseId: expense.id,
          approverId: authUser.id,
          approvalLevelId: stage.id,
          decision: ApprovalDecision.APPROVED,
          comment,
          decidedAt,
          stageName: this.routing.getRoleName(stage),
          metadata: budgetCheck.wouldExceed
            ? {
                budgetWouldExceed: true,
                overBudgetAcknowledged: Boolean(input.overBudgetAcknowledged),
                committedAmount: budgetCheck.committedAmount,
              }
            : undefined,
        });

        const before = toExpenseBudgetSnapshot(expense);

        const nextStatus = this.routing.resolveStatusAfterLevelApproval(
          stage,
          expense,
          approvalLevels,
        );
        expense.status = nextStatus;
        if (nextStatus === ExpenseStatus.APPROVED) {
          expense.approvedAt = decidedAt;
        } else {
          expense.approvedAt = undefined;
        }
        expense.rejectedAt = undefined;

        const savedExpense = await manager.getRepository(Expense).save(expense);
        await this.budgetService.syncCommittedAmountForExpenseTransition(
          manager,
          before,
          toExpenseBudgetSnapshot(savedExpense),
        );

        if (savedExpense.status === ExpenseStatus.UNDER_REVIEW) {
          await this.domainEventPublisher.publish(
            'expense.pending_finance',
            {
              expenseId: approval.expenseId,
              userId: expense.userId,
              approverId: authUser.id,
            },
            {
              manager,
              idempotencyKey: `expense.pending_finance:${approval.expenseId}:${decidedAt.toISOString()}`,
            },
          );
        } else if (savedExpense.status === ExpenseStatus.APPROVED) {
          await this.domainEventPublisher.publish(
            'expense.approved',
            {
              expenseId: approval.expenseId,
              userId: expense.userId,
              approverId: authUser.id,
            },
            {
              manager,
              idempotencyKey: `expense.approved:${approval.expenseId}:${decidedAt.toISOString()}`,
            },
          );
        }

        return {
          approval,
          expenseStatus: savedExpense.status,
          expenseUserId: expense.userId,
        };
      },
    );

    return saved.approval;
  }

  async reject(
    authUser: IAuthUser,
    expenseId: number,
    input: RejectExpenseInput,
  ): Promise<ExpenseApproval> {
    const normalizedId = this.normalizeExpenseId(expenseId);
    const comment = input.comment.trim();
    if (!comment) {
      throw new BadRequestException('Rejection comment is required');
    }

    const saved = await this.expenseRepository.manager.transaction(
      async (manager) => {
        const expense = await this.loadExpenseForDecision(
          manager,
          normalizedId,
          authUser,
        );
        const approvalLevels =
          await this.approvalLevelCatalog.getActiveLevels(manager);
        const existingApprovals = await manager
          .getRepository(ExpenseApproval)
          .find({
            where: { expenseId: expense.id },
            relations: { approvalLevel: true },
          });
        const stage = this.routing.getActiveStage(
          expense,
          approvalLevels,
          existingApprovals,
        );
        if (!stage) {
          const healed = await this.healExpenseWithNoApprovalChain(
            manager,
            expense,
            approvalLevels,
          );
          if (healed) {
            throw new ConflictException(
              'This expense has no approval stages configured and was marked approved',
            );
          }
          throw new ConflictException('This expense is not awaiting approval');
        }

        this.routing.assertReadyForStageApproval(
          stage,
          expense,
          approvalLevels,
          existingApprovals,
        );
        await this.assertCanActOnStage(authUser, stage, expense);

        await this.assertNoDecisionAtLevel(manager, expense.id, stage);

        const decidedAt = new Date();
        const approval = await this.persistApprovalDecision(manager, {
          expenseId: expense.id,
          approverId: authUser.id,
          approvalLevelId: stage.id,
          decision: ApprovalDecision.REJECTED,
          comment,
          decidedAt,
          stageName: this.routing.getRoleName(stage),
        });

        const before = toExpenseBudgetSnapshot(expense);

        expense.status = ExpenseStatus.REJECTED;
        expense.rejectedAt = decidedAt;
        expense.approvedAt = undefined;

        const savedExpense = await manager.getRepository(Expense).save(expense);
        await this.budgetService.syncCommittedAmountForExpenseTransition(
          manager,
          before,
          toExpenseBudgetSnapshot(savedExpense),
        );

        const expenseComment = await manager.getRepository(ExpenseComment).save(
          manager.getRepository(ExpenseComment).create({
            expenseId: expense.id,
            userId: authUser.id,
            body: comment,
            createdAt: decidedAt,
            updatedAt: decidedAt,
          }),
        );

        await this.domainEventPublisher.publish(
          'expense.comment.added',
          {
            expenseReference: expense.reference,
            actorId: authUser.id,
            commentReference: expenseComment.reference,
          },
          {
            manager,
            idempotencyKey: `expense.comment.added:${expenseComment.reference}`,
          },
        );

        await this.domainEventPublisher.publish(
          'expense.rejected',
          {
            expenseId: approval.expenseId,
            userId: expense.userId,
            approverId: authUser.id,
            comment,
          },
          {
            manager,
            idempotencyKey: `expense.rejected:${approval.expenseId}:${decidedAt.toISOString()}`,
          },
        );

        return {
          approval,
          expenseUserId: expense.userId,
          expenseReference: expense.reference,
          commentReference: expenseComment.reference,
        };
      },
    );

    return saved.approval;
  }

  async approveByReference(
    authUser: IAuthUser,
    expenseReference: string,
    input: ApproveExpenseInput,
  ): Promise<ExpenseApproval> {
    const expenseId = await this.resolveExpenseIdForDecision(
      authUser,
      expenseReference,
    );
    return this.approve(authUser, expenseId, input);
  }

  async rejectByReference(
    authUser: IAuthUser,
    expenseReference: string,
    input: RejectExpenseInput,
  ): Promise<ExpenseApproval> {
    const expenseId = await this.resolveExpenseIdForDecision(
      authUser,
      expenseReference,
    );
    return this.reject(authUser, expenseId, input);
  }

  async bulkApproveByReference(
    authUser: IAuthUser,
    expenseReferences: string[],
    input?: ApproveExpenseInput,
  ): Promise<BulkApprovalResult> {
    const succeeded: BulkApprovalResult['succeeded'] = [];
    const failed: BulkApprovalResult['failed'] = [];

    for (const reference of expenseReferences) {
      try {
        await this.approveByReference(authUser, reference, input ?? {});
        succeeded.push({ reference });
      } catch (error) {
        failed.push({
          reference,
          reason: this.toBulkActionErrorMessage(error),
        });
      }
    }

    return this.buildBulkApprovalResult(succeeded, failed);
  }

  async bulkRejectByReference(
    authUser: IAuthUser,
    expenseReferences: string[],
    input: RejectExpenseInput,
  ): Promise<BulkApprovalResult> {
    const succeeded: BulkApprovalResult['succeeded'] = [];
    const failed: BulkApprovalResult['failed'] = [];

    for (const reference of expenseReferences) {
      try {
        await this.rejectByReference(authUser, reference, input);
        succeeded.push({ reference });
      } catch (error) {
        failed.push({
          reference,
          reason: this.toBulkActionErrorMessage(error),
        });
      }
    }

    return this.buildBulkApprovalResult(succeeded, failed);
  }

  private buildBulkApprovalResult(
    succeeded: BulkApprovalResult['succeeded'],
    failed: BulkApprovalResult['failed'],
  ): BulkApprovalResult {
    const allSucceeded = failed.length === 0;
    return {
      succeeded,
      failed,
      partialSuccess: succeeded.length > 0 && failed.length > 0,
      allSucceeded,
    };
  }

  private toBulkActionErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        typeof response.message === 'string'
      ) {
        return response.message;
      }
    }

    if (error instanceof ForbiddenException) {
      return error.message;
    }

    if (error instanceof NotFoundException) {
      return error.message;
    }

    if (error instanceof ConflictException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Approval action failed';
  }

  private async resolveExpenseIdForDecision(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<number> {
    const resolved = await findEntityByReference(
      this.expenseRepository,
      expenseReference,
      'Expense not found',
    );

    const expense = await this.expenseRepository.findOne({
      where: { id: resolved.id },
      relations: { user: { department: true }, department: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    this.accessPolicy.assertCanDecideOnExpense(authUser, expense);
    return expense.id;
  }

  private normalizeExpenseId(id: string | number): number {
    return parsePositiveIntId(id, 'expense id');
  }

  private async loadExpenseForDecision(
    manager: EntityManager,
    expenseId: number,
    authUser: IAuthUser,
  ): Promise<Expense> {
    const normalizedId = this.normalizeExpenseId(expenseId);

    const locked = await manager.getRepository(Expense).findOne({
      where: { id: normalizedId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!locked) {
      throw new NotFoundException('Expense not found');
    }

    const expense = await manager.getRepository(Expense).findOne({
      where: { id: normalizedId },
      relations: { user: { department: true }, department: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    this.accessPolicy.assertCanDecideOnExpense(authUser, expense);
    return expense;
  }

  private async assertCanActOnStage(
    authUser: IAuthUser,
    stage: ApprovalLevel,
    expense: Expense,
  ): Promise<void> {
    if (this.routing.canActOnStage(authUser, stage, expense)) {
      return;
    }

    if (
      await this.delegationService.canActAsDelegate(authUser, expense, stage)
    ) {
      return;
    }

    throw new ForbiddenException(
      'You are not authorized to approve at the stage for this expense',
    );
  }

  private async healExpenseWithNoApprovalChain(
    manager: EntityManager,
    expense: Expense,
    approvalLevels: ApprovalLevel[],
  ): Promise<Expense | null> {
    const pending =
      expense.status === ExpenseStatus.SUBMITTED ||
      expense.status === ExpenseStatus.UNDER_REVIEW;

    if (
      !pending ||
      this.routing.requiresApprovalChain(expense, approvalLevels)
    ) {
      return null;
    }

    const before = toExpenseBudgetSnapshot(expense);
    const decidedAt = new Date();
    expense.status = ExpenseStatus.APPROVED;
    expense.approvedAt = decidedAt;
    expense.rejectedAt = undefined;
    const savedExpense = await manager.getRepository(Expense).save(expense);
    await this.budgetService.syncCommittedAmountForExpenseTransition(
      manager,
      before,
      toExpenseBudgetSnapshot(savedExpense),
    );

    return manager.getRepository(Expense).findOne({
      where: { id: expense.id },
      relations: { approvals: { approvalLevel: { role: true } } },
      order: { approvals: { approvalLevel: { level: 'ASC' } } },
    });
  }

  private async persistApprovalDecision(
    manager: EntityManager,
    input: {
      expenseId: number;
      approverId: number;
      approvalLevelId: number;
      decision: ApprovalDecision;
      comment?: string;
      decidedAt: Date;
      stageName: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ExpenseApproval> {
    try {
      const saved = await manager.getRepository(ExpenseApproval).save(
        manager.getRepository(ExpenseApproval).create({
          expenseId: input.expenseId,
          approverId: input.approverId,
          approvalLevelId: input.approvalLevelId,
          decision: input.decision,
          comment: input.comment,
          decidedAt: input.decidedAt,
          metadata: input.metadata ?? null,
        }),
      );

      return this.loadApprovalDecision(manager, saved.id);
    } catch (error) {
      if (this.isDuplicateApprovalError(error)) {
        throw new ConflictException(
          `This expense already has a decision at approval level ${input.stageName}`,
        );
      }
      throw error;
    }
  }

  private async assertOverBudgetApprovalAllowed(
    expense: Expense,
    stage: ApprovalLevel,
    comment: string | undefined,
    overBudgetAcknowledged?: boolean,
  ): Promise<{ wouldExceed: boolean; committedAmount: number }> {
    const evaluation = await this.budgetService.evaluateExpenseApprove(
      expense.departmentId,
      expense.submittedAt ?? new Date(),
    );

    if (!evaluation.wouldExceed) {
      return {
        wouldExceed: false,
        committedAmount: evaluation.committedAmount,
      };
    }

    if (!comment) {
      throw new BadRequestException(
        'A justification comment is required to approve an over-budget expense',
      );
    }

    if (
      stage.approverType === ApprovalApproverType.FINANCE_MANAGER &&
      !overBudgetAcknowledged
    ) {
      throw new BadRequestException(
        'You must acknowledge authorizing this over-budget expense before approving',
      );
    }

    return {
      wouldExceed: true,
      committedAmount: evaluation.committedAmount,
    };
  }

  private async loadApprovalDecision(
    manager: EntityManager,
    approvalId: number,
  ): Promise<ExpenseApproval> {
    const approval = await manager.getRepository(ExpenseApproval).findOne({
      where: { id: approvalId },
      relations: { approvalLevel: { role: true } },
    });

    if (!approval) {
      throw new NotFoundException('Approval decision not found');
    }

    return approval;
  }

  private isDuplicateApprovalError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string };
    return driverError?.code === '23505';
  }

  private async assertNoDecisionAtLevel(
    manager: EntityManager,
    expenseId: number,
    level: ApprovalLevel,
  ): Promise<void> {
    const exists = await manager.getRepository(ExpenseApproval).exists({
      where: {
        expenseId: this.normalizeExpenseId(expenseId),
        approvalLevelId: level.id,
      },
    });
    if (exists) {
      throw new ConflictException(
        `This expense already has a decision at approval level ${this.routing.getRoleName(level)}`,
      );
    }
  }
}
