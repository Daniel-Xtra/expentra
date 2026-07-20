import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AuditLog } from 'src/database/entities/audit-log.entity';
import { AuditAction } from 'src/database/entities/audit-log.enums';
import { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import { ExpenseComment } from 'src/database/entities/expense-comment.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { Expense } from 'src/database/entities/expense.entity';
import {
  ApprovalDecision,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type { IAuthUser } from 'src/definition';
import { AccessPolicyService } from 'src/modules/authorization';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';

export type ExpenseActivityItem = {
  type: 'COMMENT' | 'APPROVAL' | 'AUDIT';
  reference: string;
  occurredAt: Date;
  actor?: {
    reference: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type ExpensePolicyExceptionItem = {
  reference: string;
  policyReference: string;
  policyName: string | null;
  justification: string;
  createdAt: Date;
  author: {
    reference: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

@Injectable()
export class ExpenseCommentService {
  private static readonly NON_COMMENTABLE_STATUSES = new Set<ExpenseStatus>([
    ExpenseStatus.APPROVED,
    ExpenseStatus.REIMBURSED,
  ]);

  constructor(
    @InjectRepository(ExpenseComment)
    private readonly commentRepository: Repository<ExpenseComment>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseApproval)
    private readonly approvalRepository: Repository<ExpenseApproval>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(ExpensePolicy)
    private readonly policyRepository: Repository<ExpensePolicy>,
    private readonly accessPolicy: AccessPolicyService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async listComments(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<ExpenseComment[]> {
    const expense = await this.loadReadableExpense(authUser, expenseReference);

    const [comments, rejectionApprovals] = await Promise.all([
      this.commentRepository.find({
        where: { expenseId: expense.id },
        relations: { user: true },
        order: { createdAt: 'ASC' },
      }),
      this.approvalRepository.find({
        where: {
          expenseId: expense.id,
          decision: ApprovalDecision.REJECTED,
        },
        relations: { approver: true },
        order: { decidedAt: 'ASC' },
      }),
    ]);

    const legacyRejectionComments = rejectionApprovals
      .filter(
        (approval) =>
          approval.decidedAt != null &&
          Boolean(approval.comment?.trim()) &&
          !this.hasMatchingRejectionComment(approval, comments),
      )
      .map((approval) => this.toCommentFromRejectionApproval(approval));

    return [...comments, ...legacyRejectionComments].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
  }

  async addComment(
    authUser: IAuthUser,
    expenseReference: string,
    body: string,
  ): Promise<ExpenseComment> {
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Comment body cannot be empty');
    }

    const expense = await this.loadReadableExpense(authUser, expenseReference);
    this.assertCanAddComment(expense);
    const comment = await this.commentRepository.save(
      this.commentRepository.create({
        expenseId: expense.id,
        userId: authUser.id,
        body: trimmed,
      }),
    );

    const withUser = await this.commentRepository.findOne({
      where: { id: comment.id },
      relations: { user: true },
    });

    await this.domainEventPublisher.publish('expense.comment.added', {
      expenseReference: expense.reference,
      actorId: authUser.id,
      commentReference: comment.reference,
    });

    return withUser ?? comment;
  }

  async listPolicyExceptions(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<ExpensePolicyExceptionItem[]> {
    const expense = await this.loadReadableExpense(authUser, expenseReference);

    const audits = await this.auditRepository.find({
      where: {
        resourceReference: expense.reference,
        action: AuditAction.POLICY_VIOLATION,
      },
      relations: { actor: true },
      order: { createdAt: 'ASC' },
    });

    if (audits.length === 0) {
      return [];
    }

    const policyReferences = [
      ...new Set(
        audits
          .map((audit) => audit.metadata?.policyReference)
          .filter(
            (reference): reference is string => typeof reference === 'string',
          ),
      ),
    ];

    const policies = policyReferences.length
      ? await this.policyRepository.find({
          where: { reference: In(policyReferences) },
          select: { reference: true, name: true },
        })
      : [];

    const policyNameByReference = new Map(
      policies.map((policy) => [policy.reference, policy.name]),
    );

    const items: ExpensePolicyExceptionItem[] = [];

    for (const audit of audits) {
      const policyReference =
        typeof audit.metadata?.policyReference === 'string'
          ? audit.metadata.policyReference
          : '';
      const justification =
        typeof audit.metadata?.justification === 'string'
          ? audit.metadata.justification.trim()
          : '';

      if (!policyReference || !justification) {
        continue;
      }

      items.push({
        reference: audit.reference,
        policyReference,
        policyName: policyNameByReference.get(policyReference) ?? null,
        justification,
        createdAt: audit.createdAt,
        author: audit.actor
          ? {
              reference: audit.actor.reference,
              email: audit.actor.email,
              firstName: audit.actor.firstName ?? null,
              lastName: audit.actor.lastName ?? null,
            }
          : null,
      });
    }

    return items;
  }

  async getActivityTimeline(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<ExpenseActivityItem[]> {
    const expense = await this.loadReadableExpense(authUser, expenseReference);

    const [comments, approvals, audits] = await Promise.all([
      this.commentRepository.find({
        where: { expenseId: expense.id },
        relations: { user: true },
        order: { createdAt: 'ASC' },
      }),
      this.approvalRepository.find({
        where: { expenseId: expense.id },
        relations: { approver: true, approvalLevel: true },
        order: { decidedAt: 'ASC' },
      }),
      this.auditRepository.find({
        where: { resourceReference: expense.reference },
        relations: { actor: true },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const activityAudits = this.filterRedundantActivityAudits(
      audits,
      approvals,
    );

    const items: ExpenseActivityItem[] = [
      ...comments.map((comment) => ({
        type: 'COMMENT' as const,
        reference: comment.reference,
        occurredAt: comment.createdAt,
        actor: comment.user
          ? {
              reference: comment.user.reference,
              email: comment.user.email,
              firstName: comment.user.firstName,
              lastName: comment.user.lastName,
            }
          : null,
        summary: comment.body,
      })),
      ...approvals
        .filter((approval) => approval.decidedAt != null)
        .map((approval) => ({
          type: 'APPROVAL' as const,
          reference: approval.reference,
          occurredAt: approval.decidedAt,
          actor: approval.approver
            ? {
                reference: approval.approver.reference,
                email: approval.approver.email,
                firstName: approval.approver.firstName,
                lastName: approval.approver.lastName,
              }
            : null,
          summary: this.formatApprovalActivitySummary(approval),
          metadata: {
            decision: approval.decision,
            comment: approval.comment ?? null,
          },
        })),
      ...activityAudits.map((audit) => ({
        type: 'AUDIT' as const,
        reference: audit.reference,
        occurredAt: audit.createdAt,
        actor: audit.actor
          ? {
              reference: audit.actor.reference,
              email: audit.actor.email,
              firstName: audit.actor.firstName,
              lastName: audit.actor.lastName,
            }
          : null,
        summary: audit.action,
        metadata: audit.metadata,
      })),
    ];

    return items.sort(
      (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
    );
  }

  private filterRedundantActivityAudits(
    audits: AuditLog[],
    approvals: ExpenseApproval[],
  ): AuditLog[] {
    const hasApprovalDecision = (decision: ApprovalDecision) =>
      approvals.some(
        (approval) =>
          approval.decidedAt != null && approval.decision === decision,
      );

    return audits.filter((audit) => {
      switch (audit.action) {
        case AuditAction.EXPENSE_COMMENT_ADDED:
          return false;
        case AuditAction.EXPENSE_APPROVED:
          return !hasApprovalDecision(ApprovalDecision.APPROVED);
        case AuditAction.EXPENSE_REJECTED:
          return !hasApprovalDecision(ApprovalDecision.REJECTED);
        default:
          return true;
      }
    });
  }

  private formatApprovalActivitySummary(approval: ExpenseApproval): string {
    const levelName = approval.approvalLevel?.name ?? 'approval level';

    if (approval.decision === ApprovalDecision.REJECTED) {
      return `Rejected at ${levelName}`;
    }

    return `Approved at ${levelName}`;
  }

  private hasMatchingRejectionComment(
    approval: ExpenseApproval,
    comments: ExpenseComment[],
  ): boolean {
    const body = approval.comment?.trim();
    if (!body || approval.decidedAt == null || approval.approverId == null) {
      return true;
    }

    return comments.some(
      (comment) =>
        comment.userId === approval.approverId &&
        comment.body.trim() === body &&
        Math.abs(comment.createdAt.getTime() - approval.decidedAt.getTime()) <
          60_000,
    );
  }

  private toCommentFromRejectionApproval(
    approval: ExpenseApproval,
  ): ExpenseComment {
    const decidedAt = approval.decidedAt;
    const body = approval.comment!.trim();

    return {
      id: approval.id,
      reference: approval.reference,
      expenseId: approval.expenseId,
      userId: approval.approverId,
      user: approval.approver,
      body,
      createdAt: decidedAt,
      updatedAt: decidedAt,
    } as ExpenseComment;
  }

  private assertCanAddComment(expense: Expense): void {
    if (ExpenseCommentService.NON_COMMENTABLE_STATUSES.has(expense.status)) {
      throw new ConflictException(
        'Comments cannot be added after an expense has been approved',
      );
    }
  }

  private async loadReadableExpense(
    authUser: IAuthUser,
    expenseReference: string,
  ): Promise<Expense> {
    const resolved = await findEntityByReference(
      this.expenseRepository,
      expenseReference,
      'Expense not found',
    );
    const expense = await this.expenseRepository.findOne({
      where: { id: resolved.id },
      relations: { user: true },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    this.accessPolicy.assertCanReadExpense(authUser, expense);
    return expense;
  }
}
