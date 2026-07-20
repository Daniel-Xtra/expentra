import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { NotificationType } from 'src/database/entities/notification.enums';
import {
  USER_DEPARTMENT_CHANGED_EVENT,
  type UserDepartmentChangedEvent,
} from 'src/modules/user/events/user-department.events';
import { NotificationDispatchService } from '../services/notification-dispatch.service';

@Injectable()
export class UserDepartmentNotificationListener {
  private readonly logger = new Logger(UserDepartmentNotificationListener.name);

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async onUserDepartmentChanged(
    payload: UserDepartmentChangedEvent,
  ): Promise<void> {
    try {
      const departmentIds = [
        payload.previousDepartmentId,
        payload.nextDepartmentId,
      ].filter((id): id is number => typeof id === 'number');

      const departments =
        departmentIds.length > 0
          ? await this.departmentRepository.find({
              where: { id: In(departmentIds) },
              select: { id: true, reference: true, name: true },
            })
          : [];

      const departmentById = new Map(
        departments.map((dept) => [dept.id, dept]),
      );
      const previousDepartment = payload.previousDepartmentId
        ? departmentById.get(payload.previousDepartmentId)
        : undefined;
      const nextDepartment = payload.nextDepartmentId
        ? departmentById.get(payload.nextDepartmentId)
        : undefined;

      const body = nextDepartment
        ? `Your department assignment was updated to ${nextDepartment.name}.`
        : previousDepartment
          ? `You were removed from ${previousDepartment.name}.`
          : 'Your department assignment was updated.';

      await this.dispatchService.dispatchInApp({
        userId: payload.userId,
        notificationType: NotificationType.USER_DEPARTMENT_CHANGED,
        title: 'Department assignment updated',
        body,
        data: {
          userReference: payload.userReference,
          previousDepartmentReference: previousDepartment?.reference,
          nextDepartmentReference: nextDepartment?.reference,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed in-app user department notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
