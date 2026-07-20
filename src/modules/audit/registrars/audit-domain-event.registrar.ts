import { Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEventHandlerRegistry } from 'src/core/outbox/services/domain-event-handler.registry';
import { DEPARTMENT_MANAGER_CHANGED_EVENT } from 'src/modules/department/events/department-manager.events';
import { USER_DEPARTMENT_CHANGED_EVENT } from 'src/modules/user/events/user-department.events';
import { USER_ROLE_CHANGED_EVENT } from 'src/modules/user/events/user-role.events';
import { USER_SUSPENDED_EVENT } from 'src/modules/user/events/user-lifecycle.events';
import { ROLE_PERMISSIONS_CHANGED_EVENT } from 'src/modules/role/events/role-admin.events';
import { DomainAuditListener } from '../listeners/domain-audit.listener';

@Injectable()
export class AuditDomainEventRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: DomainEventHandlerRegistry,
    private readonly auditListener: DomainAuditListener,
  ) {}

  onModuleInit(): void {
    this.registry.register('expense.submitted', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onExpenseSubmitted(payload as never),
      },
    ]);
    this.registry.register('expense.approved', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onExpenseApproved(payload as never),
      },
    ]);
    this.registry.register('expense.rejected', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onExpenseRejected(payload as never),
      },
    ]);
    this.registry.register('expense.reimbursed', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onExpenseReimbursed(payload as never),
      },
    ]);
    this.registry.register('expense.reopened', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onExpenseReopened(payload as never),
      },
    ]);
    this.registry.register('expense.comment.added', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onExpenseCommentAdded(payload as never),
      },
    ]);
    this.registry.register('delegation.created', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onDelegationCreated(payload as never),
      },
    ]);
    this.registry.register('delegation.revoked', (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onDelegationRevoked(payload as never),
      },
    ]);
    this.registry.register(USER_DEPARTMENT_CHANGED_EVENT, (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onUserDepartmentChanged(payload as never),
      },
    ]);
    this.registry.register(DEPARTMENT_MANAGER_CHANGED_EVENT, (payload) => [
      {
        name: 'audit',
        run: () =>
          this.auditListener.onDepartmentManagerChanged(payload as never),
      },
    ]);
    this.registry.register(ROLE_PERMISSIONS_CHANGED_EVENT, (payload) => [
      {
        name: 'audit',
        run: () =>
          this.auditListener.onRolePermissionsChanged(payload as never),
      },
    ]);
    this.registry.register(USER_ROLE_CHANGED_EVENT, (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onUserRoleChanged(payload as never),
      },
    ]);
    this.registry.register(USER_SUSPENDED_EVENT, (payload) => [
      {
        name: 'audit',
        run: () => this.auditListener.onUserSuspended(payload as never),
      },
    ]);
  }
}
