import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { NotificationType } from 'src/database/entities/notification.enums';
import { PermissionScope } from 'src/modules/authorization';
import {
  USER_SERVICE,
  type IUserService,
} from 'src/modules/user/contracts/user.contract';
import { EmailContentBuilder } from '../builders/email-content.builder';
import { NotificationDispatchService } from '../services/notification-dispatch.service';

export type BudgetOverspendEvent = {
  expenseId: number;
  userId: number;
  departmentId: number;
  year: number;
  amountLimit: number;
  projectedCommittedAmount: number;
};

@Injectable()
export class BudgetNotificationListener {
  private readonly logger = new Logger(BudgetNotificationListener.name);

  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    private readonly dispatchService: NotificationDispatchService,
    private readonly emailContent: EmailContentBuilder,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async onBudgetOverspend(payload: BudgetOverspendEvent): Promise<void> {
    try {
      const [expense, department] = await Promise.all([
        this.expenseRepository.findOne({ where: { id: payload.expenseId } }),
        this.departmentRepository.findOne({
          where: { id: payload.departmentId },
        }),
      ]);
      if (!expense || !department) {
        return;
      }

      const financeUsers = await this.userService.findActiveUsersWithPermission(
        'reimburse',
        'expense',
        PermissionScope.GLOBAL,
      );

      const content = this.emailContent.budgetOverspendAlert({
        expenseReference: expense.reference,
        departmentReference: department.reference,
        year: payload.year,
        month: new Date().getUTCMonth() + 1,
        amountLimit: payload.amountLimit,
        projectedCommittedAmount: payload.projectedCommittedAmount,
      });

      for (const user of financeUsers) {
        await this.dispatchService.scheduleEmail({
          userId: user.id,
          notificationType: NotificationType.BUDGET_OVERSPEND,
          to: user.email,
          template: content.template,
          data: content.data,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to queue budget.overspend notifications: ${message}`,
      );
    }
  }
}
