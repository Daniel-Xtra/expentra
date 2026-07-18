import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import { NotificationType } from 'src/database/entities/notification.enums';
import {
  USER_SERVICE,
  type IUserService,
} from 'src/modules/user/contracts/user.contract';
import { NotificationDispatchService } from '../services/notification-dispatch.service';
import type {
  ExpenseApprovedEvent,
  ExpensePendingFinanceEvent,
  ExpenseRejectedEvent,
  ExpenseReimbursedEvent,
  ExpenseSubmittedEvent,
} from '../types/notification-events.types';

@Injectable()
export class InAppNotificationListener {
  private readonly logger = new Logger(InAppNotificationListener.name);

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async onSubmitted(payload: ExpenseSubmittedEvent): Promise<void> {
    const expense = await this.loadExpense(payload.expenseId);
    if (!expense) {
      return;
    }

    await this.notifyUser(
      payload.userId,
      NotificationType.EXPENSE_SUBMITTED,
      'Expense submitted',
      'Your expense was submitted for approval.',
      expense,
    );

    await this.notifyApprovers(expense, payload.userId);
  }

  async onPendingFinance(payload: ExpensePendingFinanceEvent): Promise<void> {
    const expense = await this.loadExpense(payload.expenseId);
    if (!expense) {
      return;
    }

    await this.notifyUser(
      payload.userId,
      NotificationType.EXPENSE_PENDING_FINANCE,
      'Expense approved at current stage',
      'Your expense was approved and is awaiting the next reviewer.',
      expense,
    );

    try {
      const financeUsers =
        await this.userService.findActiveUsersForFinanceQueueNotification();

      for (const user of financeUsers) {
        if (user.id === payload.userId) {
          continue;
        }

        await this.dispatchService.dispatchInApp({
          userId: user.id,
          notificationType: NotificationType.EXPENSE_PENDING_FINANCE,
          title: 'Expense awaiting finance approval',
          body: `"${expense.title}" needs the next approval in the chain.`,
          data: {
            expenseReference: expense.reference,
            expenseTitle: expense.title,
            amount: expense.amount,
            currency: expense.currency,
          },
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed in-app finance queue notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onApproved(payload: ExpenseApprovedEvent): Promise<void> {
    const expense = await this.loadExpense(payload.expenseId);
    if (!expense) {
      return;
    }

    await this.notifyUser(
      payload.userId,
      NotificationType.EXPENSE_APPROVED,
      'Expense approved',
      'Your expense was approved.',
      expense,
    );
  }

  async onRejected(payload: ExpenseRejectedEvent): Promise<void> {
    const expense = await this.loadExpense(payload.expenseId);
    if (!expense) {
      return;
    }

    await this.notifyUser(
      payload.userId,
      NotificationType.EXPENSE_REJECTED,
      'Expense rejected',
      payload.comment || 'Your expense was rejected.',
      expense,
    );
  }

  async onReimbursed(payload: ExpenseReimbursedEvent): Promise<void> {
    const expense = await this.loadExpense(payload.expenseId);
    if (!expense) {
      return;
    }

    await this.notifyUser(
      payload.userId,
      NotificationType.EXPENSE_REIMBURSED,
      'Expense reimbursed',
      'Your expense has been marked as reimbursed.',
      expense,
    );
  }

  async onBudgetThreshold(payload: {
    userId: number;
    departmentReference: string;
    departmentName: string;
    thresholdPercent: number;
    utilizationPercent: number;
    year: number;
  }): Promise<void> {
    try {
      await this.dispatchService.dispatchInApp({
        userId: payload.userId,
        notificationType: NotificationType.BUDGET_THRESHOLD,
        title: `${payload.departmentName} budget at ${payload.utilizationPercent}%`,
        body: `${payload.departmentName} budget has crossed the ${payload.thresholdPercent}% threshold for ${payload.year}.`,
        data: {
          departmentReference: payload.departmentReference,
          departmentName: payload.departmentName,
          thresholdPercent: payload.thresholdPercent,
          utilizationPercent: payload.utilizationPercent,
          year: payload.year,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed in-app budget threshold notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyApprovers(
    expense: Expense,
    submitterId: number,
  ): Promise<void> {
    try {
      const submitter = await this.userService.findOne(submitterId);
      const approvers =
        await this.userService.findActiveUsersForExpenseApprovalNotification(
          expense.departmentId,
        );

      const submitterName =
        [submitter.firstName, submitter.lastName].filter(Boolean).join(' ') ||
        submitter.email;
      const amountLabel = this.formatAmount(expense.amount, expense.currency);

      for (const approver of approvers) {
        if (approver.id === submitterId) {
          continue;
        }

        await this.dispatchService.dispatchInApp({
          userId: approver.id,
          notificationType: NotificationType.EXPENSE_SUBMITTED,
          title: 'Expense awaiting your approval',
          body: `${submitterName} submitted "${expense.title}" (${amountLabel}) for approval.`,
          data: {
            expenseReference: expense.reference,
            expenseTitle: expense.title,
            submitterReference: submitter.reference,
            amount: expense.amount,
            currency: expense.currency,
          },
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed in-app approver notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyUser(
    userId: number,
    type: NotificationType,
    title: string,
    body: string,
    expense: Expense,
  ): Promise<void> {
    try {
      await this.dispatchService.dispatchInApp({
        userId,
        notificationType: type,
        title,
        body,
        data: {
          expenseReference: expense.reference,
          expenseTitle: expense.title,
          amount: expense.amount,
          currency: expense.currency,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed in-app ${type} notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async loadExpense(expenseId: number): Promise<Expense | null> {
    return this.expenseRepository.findOne({
      where: { id: expenseId },
      select: {
        id: true,
        reference: true,
        title: true,
        amount: true,
        currency: true,
        departmentId: true,
      },
    });
  }

  private formatAmount(amountKobo: number, currency: string): string {
    const major = (amountKobo / 100).toFixed(2);
    return currency === 'NGN' ? `â‚¦${major}` : `${currency} ${major}`;
  }
}
