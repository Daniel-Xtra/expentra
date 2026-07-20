import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { NotificationType } from 'src/database/entities/notification.enums';
import { User } from 'src/database/entities/user.entity';
import {
  DEPARTMENT_MANAGER_CHANGED_EVENT,
  type DepartmentManagerChangedEvent,
} from 'src/modules/department/events/department-manager.events';
import { NotificationDispatchService } from '../services/notification-dispatch.service';

@Injectable()
export class DepartmentManagerNotificationListener {
  private readonly logger = new Logger(
    DepartmentManagerNotificationListener.name,
  );

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onDepartmentManagerChanged(
    payload: DepartmentManagerChangedEvent,
  ): Promise<void> {
    try {
      const department = await this.departmentRepository.findOne({
        where: { id: payload.departmentId },
        select: { id: true, reference: true, name: true },
      });
      if (!department) {
        return;
      }

      const managerIds = [
        payload.previousManagerId,
        payload.nextManagerId,
      ].filter((id): id is number => typeof id === 'number');

      const managers =
        managerIds.length > 0
          ? await this.userRepository.find({
              where: { id: In(managerIds) },
              select: { id: true, reference: true },
            })
          : [];

      const managerById = new Map(managers.map((user) => [user.id, user]));

      if (payload.nextManagerId) {
        await this.dispatchService.dispatchInApp({
          userId: payload.nextManagerId,
          notificationType: NotificationType.DEPARTMENT_MANAGER_CHANGED,
          title: 'Department manager assignment',
          body: `You have been assigned as manager of ${department.name}.`,
          data: {
            departmentReference: department.reference,
            role: 'assigned',
          },
        });
      }

      const previousManager = payload.previousManagerId
        ? managerById.get(payload.previousManagerId)
        : undefined;

      if (
        payload.previousManagerId &&
        payload.previousManagerId !== payload.nextManagerId
      ) {
        await this.dispatchService.dispatchInApp({
          userId: payload.previousManagerId,
          notificationType: NotificationType.DEPARTMENT_MANAGER_CHANGED,
          title: 'Department manager assignment',
          body: `You are no longer the manager of ${department.name}.`,
          data: {
            departmentReference: department.reference,
            role: 'removed',
            ...(previousManager
              ? { managerReference: previousManager.reference }
              : {}),
          },
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed department manager notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
