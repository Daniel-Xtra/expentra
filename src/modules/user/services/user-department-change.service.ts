import { Inject, Injectable } from '@nestjs/common';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from 'src/database/entities/user.entity';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from 'src/modules/budget/contracts/budget.contract';
import { DepartmentManagerService } from 'src/modules/department/services/department-manager.service';
import {
  USER_DEPARTMENT_CHANGED_EVENT,
  type UserDepartmentChangedEvent,
} from '../events/user-department.events';

@Injectable()
export class UserDepartmentChangeService {
  constructor(
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly departmentManagerService: DepartmentManagerService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async assertCanLeaveDepartment(
    departmentId: number,
    userId: number,
  ): Promise<void> {
    await this.departmentManagerService.assertManagerCanLeaveDepartment(
      departmentId,
      userId,
    );
  }

  async applyWithinTransaction(input: {
    manager: EntityManager;
    user: User;
    actorId: number;
    previousDepartmentId?: number;
  }): Promise<void> {
    const { manager, user, actorId, previousDepartmentId } = input;

    await this.budgetService.syncCommittedAmountForUserDepartmentChange(
      manager,
      user.id,
      previousDepartmentId,
      user.departmentId,
    );

    if (previousDepartmentId && previousDepartmentId !== user.departmentId) {
      await this.departmentManagerService.releaseManagerIfUserLeftDepartment(
        previousDepartmentId,
        user.id,
        actorId,
        manager,
      );
    }
  }

  emitDepartmentChanged(event: UserDepartmentChangedEvent): void {
    void this.domainEventPublisher.publish(
      USER_DEPARTMENT_CHANGED_EVENT,
      event,
    );
  }
}
