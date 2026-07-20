import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditAction,
  AuditResourceType,
} from 'src/database/entities/audit-log.enums';
import { Expense } from 'src/database/entities/expense.entity';
import type { UserDepartmentChangedEvent } from 'src/modules/user/events/user-department.events';
import type { UserRoleChangedEvent } from 'src/modules/user/events/user-role.events';
import type { UserSuspendedEvent } from 'src/modules/user/events/user-lifecycle.events';
import type { RolePermissionsChangedEvent } from 'src/modules/role/events/role-admin.events';
import {
  DEPARTMENT_MANAGER_CHANGED_EVENT,
  type DepartmentManagerChangedEvent,
} from 'src/modules/department/events/department-manager.events';
import { AUDIT_SERVICE, type IAuditService } from '../contracts/audit.contract';

type ExpenseEvent = {
  expenseId: number;
  userId: number;
  approverId?: number;
  financeId?: number;
  comment?: string;
  policyJustifications?: Record<string, string>;
};

@Injectable()
export class DomainAuditListener {
  private readonly logger = new Logger(DomainAuditListener.name);

  constructor(
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async onExpenseSubmitted(payload: ExpenseEvent): Promise<void> {
    const expense = await this.recordExpenseEvent(
      payload,
      AuditAction.EXPENSE_SUBMITTED,
      payload.userId,
    );
    if (expense) {
      await this.recordPolicyJustifications(
        expense.reference,
        payload.userId,
        payload.policyJustifications,
      );
    }
  }

  async onExpenseApproved(payload: ExpenseEvent): Promise<void> {
    const expense = await this.recordExpenseEvent(
      payload,
      AuditAction.EXPENSE_APPROVED,
      payload.approverId ?? payload.userId,
    );
    if (expense) {
      await this.recordPolicyJustifications(
        expense.reference,
        payload.userId,
        payload.policyJustifications,
      );
    }
  }

  async onExpenseRejected(payload: ExpenseEvent): Promise<void> {
    await this.recordExpenseEvent(
      payload,
      AuditAction.EXPENSE_REJECTED,
      payload.approverId ?? payload.userId,
      { comment: payload.comment },
    );
  }

  async onExpenseReopened(payload: {
    expenseId: number;
    userId: number;
  }): Promise<void> {
    await this.recordExpenseEvent(
      payload,
      AuditAction.EXPENSE_REOPENED,
      payload.userId,
    );
  }

  async onExpenseReimbursed(payload: ExpenseEvent): Promise<void> {
    await this.recordExpenseEvent(
      payload,
      AuditAction.EXPENSE_REIMBURSED,
      payload.financeId ?? payload.userId,
    );
  }

  async onExpenseCommentAdded(payload: {
    expenseReference: string;
    actorId: number;
    commentReference: string;
  }): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorId,
        action: AuditAction.EXPENSE_COMMENT_ADDED,
        resourceType: AuditResourceType.EXPENSE,
        resourceReference: payload.expenseReference,
        metadata: { commentReference: payload.commentReference },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record expense comment audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onDelegationCreated(payload: {
    actorId: number;
    delegationReference: string;
    delegateReference: string;
  }): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorId,
        action: AuditAction.DELEGATION_CREATED,
        resourceType: AuditResourceType.DELEGATION,
        resourceReference: payload.delegationReference,
        metadata: { delegateReference: payload.delegateReference },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record delegation audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onDelegationRevoked(payload: {
    actorId: number;
    delegationReference: string;
  }): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorId,
        action: AuditAction.DELEGATION_REVOKED,
        resourceType: AuditResourceType.DELEGATION,
        resourceReference: payload.delegationReference,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record delegation revoke audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onUserDepartmentChanged(
    payload: UserDepartmentChangedEvent,
  ): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorUserId,
        action: AuditAction.USER_DEPARTMENT_CHANGED,
        resourceType: AuditResourceType.USER,
        resourceReference: payload.userReference,
        metadata: {
          previousDepartmentReference:
            payload.previousDepartmentReference ?? null,
          nextDepartmentReference: payload.nextDepartmentReference ?? null,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record user department change audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onDepartmentManagerChanged(
    payload: DepartmentManagerChangedEvent,
  ): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorUserId ?? null,
        action: AuditAction.DEPARTMENT_MANAGER_CHANGED,
        resourceType: AuditResourceType.DEPARTMENT,
        resourceReference: payload.departmentReference,
        metadata: {
          previousManagerReference: payload.previousManagerReference,
          nextManagerReference: payload.nextManagerReference,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record department manager change audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onRolePermissionsChanged(
    payload: RolePermissionsChangedEvent,
  ): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorUserId,
        action: AuditAction.ROLE_PERMISSIONS_CHANGED,
        resourceType: AuditResourceType.ROLE,
        resourceReference: payload.roleReference,
        metadata: {
          permissionNames: payload.permissionNames,
          permissionCount: payload.permissionNames.length,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record role permissions change audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onUserRoleChanged(payload: UserRoleChangedEvent): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorUserId,
        action: AuditAction.USER_ROLE_CHANGED,
        resourceType: AuditResourceType.USER,
        resourceReference: payload.userReference,
        metadata: {
          previousRoleReference: payload.previousRoleReference,
          nextRoleReference: payload.nextRoleReference,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record user role change audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onUserSuspended(payload: UserSuspendedEvent): Promise<void> {
    try {
      await this.auditService.record({
        actorId: payload.actorUserId,
        action: AuditAction.USER_SUSPENDED,
        resourceType: AuditResourceType.USER,
        resourceReference: payload.userReference,
        metadata: {
          pendingExpenseCount: payload.pendingExpenses.length,
          pendingExpenses: payload.pendingExpenses,
          deactivatedAt: payload.changes.deactivatedAt ?? null,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record user suspended audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async recordExpenseEvent(
    payload: ExpenseEvent,
    action: AuditAction,
    actorId: number,
    metadata: Record<string, unknown> = {},
  ): Promise<Pick<Expense, 'reference'> | null> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: payload.expenseId },
        select: { id: true, reference: true },
      });
      if (!expense) return null;

      await this.auditService.record({
        actorId,
        action,
        resourceType: AuditResourceType.EXPENSE,
        resourceReference: expense.reference,
        metadata,
      });
      return expense;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record ${action} audit: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async recordPolicyJustifications(
    expenseReference: string,
    actorId: number,
    policyJustifications?: Record<string, string>,
  ): Promise<void> {
    if (!policyJustifications) {
      return;
    }

    for (const [policyReference, rawJustification] of Object.entries(
      policyJustifications,
    )) {
      const justification = rawJustification?.trim();
      if (!justification) {
        continue;
      }

      try {
        await this.auditService.record({
          actorId,
          action: AuditAction.POLICY_VIOLATION,
          resourceType: AuditResourceType.EXPENSE,
          resourceReference: expenseReference,
          metadata: { policyReference, justification },
        });
      } catch (error: unknown) {
        this.logger.error(
          `Failed to record policy justification audit: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
