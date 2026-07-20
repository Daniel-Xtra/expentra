import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalNotificationService } from 'src/core/utils/email/external-notification.service';
import { Department } from 'src/database/entities/department.entity';
import { User } from 'src/database/entities/user.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { Notification } from 'src/database/entities/notification.entity';
import { NotificationPreference } from 'src/database/entities/notification-preference.entity';
import { UserModule } from 'src/modules/user/user.module';
import { EMAIL_NOTIFICATION_QUEUE } from './constants/notification-queue';
import { EXTERNAL_NOTIFICATION_SENDER } from './contracts/external-notification.contract';
import { EmailContentBuilder } from './builders/email-content.builder';
import { AuthNotificationListener } from './listeners/auth-notification.listener';
import { BudgetNotificationListener } from './listeners/budget-notification.listener';
import { ExpenseNotificationListener } from './listeners/expense-notification.listener';
import { NotificationController } from './controllers/notification.controller';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationInboxService } from './services/notification-inbox.service';
import { InAppNotificationListener } from './listeners/in-app-notification.listener';
import { DepartmentManagerNotificationListener } from './listeners/department-manager-notification.listener';
import { UserDepartmentNotificationListener } from './listeners/user-department-notification.listener';
import { UserLifecycleNotificationListener } from './listeners/user-lifecycle-notification.listener';
import { NotificationDomainEventRegistrar } from './registrars/notification-domain-event.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      Expense,
      Department,
      User,
    ]),
    BullModule.registerQueue({ name: EMAIL_NOTIFICATION_QUEUE }),
    forwardRef(() => UserModule),
  ],
  controllers: [NotificationController],
  providers: [
    ExternalNotificationService,
    NotificationInboxService,
    NotificationDispatchService,
    EmailContentBuilder,
    ExpenseNotificationListener,
    BudgetNotificationListener,
    AuthNotificationListener,
    InAppNotificationListener,
    UserDepartmentNotificationListener,
    DepartmentManagerNotificationListener,
    UserLifecycleNotificationListener,
    NotificationDomainEventRegistrar,
    {
      provide: EXTERNAL_NOTIFICATION_SENDER,
      useExisting: ExternalNotificationService,
    },
  ],
  exports: [
    NotificationDispatchService,
    NotificationInboxService,
    EmailContentBuilder,
    EXTERNAL_NOTIFICATION_SENDER,
    ExpenseNotificationListener,
    InAppNotificationListener,
    AuthNotificationListener,
    BudgetNotificationListener,
    UserDepartmentNotificationListener,
    DepartmentManagerNotificationListener,
    UserLifecycleNotificationListener,
  ],
})
export class NotificationModule {}
