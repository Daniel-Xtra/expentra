import { Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEventHandlerRegistry } from 'src/core/outbox/services/domain-event-handler.registry';
import { DEPARTMENT_MANAGER_CHANGED_EVENT } from 'src/modules/department/events/department-manager.events';
import { USER_DEPARTMENT_CHANGED_EVENT } from 'src/modules/user/events/user-department.events';
import { USER_SUSPENDED_EVENT } from 'src/modules/user/events/user-lifecycle.events';
import { AuthNotificationListener } from '../listeners/auth-notification.listener';
import { BudgetNotificationListener } from '../listeners/budget-notification.listener';
import { DepartmentManagerNotificationListener } from '../listeners/department-manager-notification.listener';
import { ExpenseNotificationListener } from '../listeners/expense-notification.listener';
import { InAppNotificationListener } from '../listeners/in-app-notification.listener';
import { UserDepartmentNotificationListener } from '../listeners/user-department-notification.listener';
import { UserLifecycleNotificationListener } from '../listeners/user-lifecycle-notification.listener';

@Injectable()
export class NotificationDomainEventRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: DomainEventHandlerRegistry,
    private readonly expenseNotificationListener: ExpenseNotificationListener,
    private readonly inAppNotificationListener: InAppNotificationListener,
    private readonly authNotificationListener: AuthNotificationListener,
    private readonly budgetNotificationListener: BudgetNotificationListener,
    private readonly userDepartmentNotificationListener: UserDepartmentNotificationListener,
    private readonly departmentManagerNotificationListener: DepartmentManagerNotificationListener,
    private readonly userLifecycleNotificationListener: UserLifecycleNotificationListener,
  ) {}

  onModuleInit(): void {
    this.registry.register('expense.submitted', (payload) => [
      {
        name: 'expense-email',
        run: () =>
          this.expenseNotificationListener.onExpenseSubmitted(payload as never),
      },
      {
        name: 'in-app',
        run: () => this.inAppNotificationListener.onSubmitted(payload as never),
      },
    ]);
    this.registry.register('expense.pending_finance', (payload) => [
      {
        name: 'expense-email',
        run: () =>
          this.expenseNotificationListener.onExpensePendingFinance(
            payload as never,
          ),
      },
      {
        name: 'in-app',
        run: () =>
          this.inAppNotificationListener.onPendingFinance(payload as never),
      },
    ]);
    this.registry.register('expense.escalated', (payload) => [
      {
        name: 'expense-email',
        run: () =>
          this.expenseNotificationListener.onExpenseEscalated(payload as never),
      },
    ]);
    this.registry.register('expense.approved', (payload) => [
      {
        name: 'expense-email',
        run: () =>
          this.expenseNotificationListener.onExpenseApproved(payload as never),
      },
      {
        name: 'in-app',
        run: () => this.inAppNotificationListener.onApproved(payload as never),
      },
    ]);
    this.registry.register('expense.rejected', (payload) => [
      {
        name: 'expense-email',
        run: () =>
          this.expenseNotificationListener.onExpenseRejected(payload as never),
      },
      {
        name: 'in-app',
        run: () => this.inAppNotificationListener.onRejected(payload as never),
      },
    ]);
    this.registry.register('expense.reimbursed', (payload) => [
      {
        name: 'expense-email',
        run: () =>
          this.expenseNotificationListener.onExpenseReimbursed(payload as never),
      },
      {
        name: 'in-app',
        run: () => this.inAppNotificationListener.onReimbursed(payload as never),
      },
    ]);
    this.registry.register('budget.overspend', (payload) => [
      {
        name: 'budget-email',
        run: () =>
          this.budgetNotificationListener.onBudgetOverspend(payload as never),
      },
    ]);
    this.registry.register('budget.threshold_crossed', (payload) => [
      {
        name: 'in-app',
        run: () =>
          this.inAppNotificationListener.onBudgetThreshold(payload as never),
      },
    ]);
    this.registry.register(USER_DEPARTMENT_CHANGED_EVENT, (payload) => [
      {
        name: 'user-dept-email',
        run: () =>
          this.userDepartmentNotificationListener.onUserDepartmentChanged(
            payload as never,
          ),
      },
    ]);
    this.registry.register(DEPARTMENT_MANAGER_CHANGED_EVENT, (payload) => [
      {
        name: 'dept-mgr-email',
        run: () =>
          this.departmentManagerNotificationListener.onDepartmentManagerChanged(
            payload as never,
          ),
      },
    ]);
    this.registry.register(USER_SUSPENDED_EVENT, (payload) => [
      {
        name: 'user-lifecycle-in-app',
        run: () =>
          this.userLifecycleNotificationListener.onUserSuspended(
            payload as never,
          ),
      },
    ]);
    this.registry.register('auth.email-verification', (payload) => [
      {
        name: 'auth-email',
        run: () =>
          this.authNotificationListener.onEmailVerification(payload as never),
      },
    ]);
    this.registry.register('auth.password-reset', (payload) => [
      {
        name: 'auth-email',
        run: () =>
          this.authNotificationListener.onPasswordReset(payload as never),
      },
    ]);
  }
}
