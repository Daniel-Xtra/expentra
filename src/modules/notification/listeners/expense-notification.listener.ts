import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import {
  USER_SERVICE,
  type IUserService,
} from 'src/modules/user/contracts/user.contract';
import { EmailContentBuilder } from '../builders/email-content.builder';
import { NotificationType } from 'src/database/entities/notification.enums';
import { NotificationDispatchService } from '../services/notification-dispatch.service';
import type {
  ExpenseApprovedEvent,
  ExpenseEscalatedEvent,
  ExpensePendingFinanceEvent,
  ExpenseRejectedEvent,
  ExpenseReimbursedEvent,
  ExpenseSubmittedEvent,
} from '../types/notification-events.types';

@Injectable()
export class ExpenseNotificationListener {
  private readonly logger = new Logger(ExpenseNotificationListener.name);

  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    private readonly dispatchService: NotificationDispatchService,
    private readonly emailContent: EmailContentBuilder,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async onExpenseSubmitted(payload: ExpenseSubmittedEvent): Promise<void> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: payload.expenseId },
      });
      if (!expense) return;

      const submitter = await this.userService.findOne(payload.userId);
      const managers =
        await this.userService.findActiveUsersForExpenseApprovalNotification(
          expense.departmentId,
        );

      const content = this.emailContent.expenseSubmittedForManager(
        expense,
        submitter,
      );

      for (const manager of managers) {
        if (manager.id === payload.userId) {
          continue;
        }

        await this.dispatchService.scheduleEmail({
          userId: manager.id,
          notificationType: NotificationType.EXPENSE_SUBMITTED,
          to: manager.email,
          template: content.template,
          data: content.data,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue expense.submitted notifications: ${message}`,
      );
    }
  }

  async onExpensePendingFinance(
    payload: ExpensePendingFinanceEvent,
  ): Promise<void> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: payload.expenseId },
      });
      if (!expense) return;

      const financeUsers =
        await this.userService.findActiveUsersForFinanceQueueNotification();

      const content = this.emailContent.expensePendingFinanceReview(expense);

      for (const user of financeUsers) {
        await this.dispatchService.scheduleEmail({
          userId: user.id,
          notificationType: NotificationType.EXPENSE_PENDING_FINANCE,
          to: user.email,
          template: content.template,
          data: content.data,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue expense.pending_finance notifications: ${message}`,
      );
    }
  }

  async onExpenseEscalated(payload: ExpenseEscalatedEvent): Promise<void> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: payload.expenseId },
      });
      if (!expense) return;

      const recipients =
        payload.status === ExpenseStatus.UNDER_REVIEW
          ? await this.userService.findActiveUsersForFinanceQueueNotification()
          : await this.userService.findActiveUsersForExpenseApprovalNotification(
              expense.departmentId,
            );

      const content = this.emailContent.expenseEscalationReminder(
        expense,
        payload.status,
      );

      for (const user of recipients) {
        if (user.id === payload.userId) {
          continue;
        }

        await this.dispatchService.scheduleEmail({
          userId: user.id,
          notificationType: NotificationType.EXPENSE_ESCALATED,
          to: user.email,
          template: content.template,
          data: content.data,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue expense.escalated notifications: ${message}`,
      );
    }
  }

  async onExpenseApproved(payload: ExpenseApprovedEvent): Promise<void> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: payload.expenseId },
      });
      if (!expense) return;

      const employee = await this.userService.findOne(payload.userId);
      const content = this.emailContent.expenseApprovedForEmployee(expense);

      await this.dispatchService.scheduleEmail({
        userId: employee.id,
        notificationType: NotificationType.EXPENSE_APPROVED,
        to: employee.email,
        template: content.template,
        data: content.data,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue expense.approved notification: ${message}`,
      );
    }
  }

  async onExpenseRejected(payload: ExpenseRejectedEvent): Promise<void> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: payload.expenseId },
      });
      if (!expense) return;

      const employee = await this.userService.findOne(payload.userId);
      const content = this.emailContent.expenseRejectedForEmployee(
        expense,
        payload.comment,
      );

      await this.dispatchService.scheduleEmail({
        userId: employee.id,
        notificationType: NotificationType.EXPENSE_REJECTED,
        to: employee.email,
        template: content.template,
        data: content.data,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue expense.rejected notification: ${message}`,
      );
    }
  }

  async onExpenseReimbursed(payload: ExpenseReimbursedEvent): Promise<void> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: payload.expenseId },
      });
      if (!expense) return;

      const employee = await this.userService.findOne(payload.userId);
      const content = this.emailContent.expenseReimbursedForEmployee(expense);

      await this.dispatchService.scheduleEmail({
        userId: employee.id,
        notificationType: NotificationType.EXPENSE_REIMBURSED,
        to: employee.email,
        template: content.template,
        data: content.data,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue expense.reimbursed notification: ${message}`,
      );
    }
  }
}
