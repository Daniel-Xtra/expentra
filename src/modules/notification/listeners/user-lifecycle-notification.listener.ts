import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationType } from 'src/database/entities/notification.enums';
import { PermissionScope } from 'src/modules/authorization';
import {
  USER_SERVICE,
  type IUserService,
} from 'src/modules/user/contracts/user.contract';
import type { UserSuspendedEvent } from 'src/modules/user/events/user-lifecycle.events';
import { NotificationDispatchService } from '../services/notification-dispatch.service';

@Injectable()
export class UserLifecycleNotificationListener {
  private readonly logger = new Logger(UserLifecycleNotificationListener.name);

  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    private readonly dispatchService: NotificationDispatchService,
  ) {}

  async onUserSuspended(payload: UserSuspendedEvent): Promise<void> {
    try {
      const admins = await this.userService.findActiveUsersWithPermission(
        'update',
        'user',
        PermissionScope.GLOBAL,
      );

      const pendingCount = payload.pendingExpenses.length;
      const expenseLines =
        pendingCount === 0
          ? 'No pending expenses.'
          : payload.pendingExpenses
              .slice(0, 10)
              .map((expense) => `${expense.reference} (${expense.status})`)
              .join(', ') +
            (pendingCount > 10 ? ` and ${pendingCount - 10} more` : '');

      const title = 'User deactivated with pending expenses';
      const body =
        pendingCount === 0
          ? `User ${payload.userReference} was deactivated with no open expenses.`
          : `User ${payload.userReference} was deactivated with ${pendingCount} pending expense(s): ${expenseLines}`;

      for (const admin of admins) {
        if (admin.id === payload.targetUserId) {
          continue;
        }

        await this.dispatchService.dispatchInApp({
          userId: admin.id,
          notificationType: NotificationType.USER_SUSPENDED,
          title,
          body,
          data: {
            userReference: payload.userReference,
            pendingExpenseCount: pendingCount,
            pendingExpenses: payload.pendingExpenses,
          },
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed user suspended notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
