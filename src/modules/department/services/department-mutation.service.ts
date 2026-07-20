import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { User } from 'src/database/entities/user.entity';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import {
  DEPARTMENT_MANAGER_CHANGED_EVENT,
  type DepartmentManagerChangedEvent,
} from '../events/department-manager.events';
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from '../types/department.types';
import { DepartmentManagerService } from './department-manager.service';
import { DepartmentQueryService } from './department-query.service';

@Injectable()
export class DepartmentMutationService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly departmentQueryService: DepartmentQueryService,
    private readonly departmentManagerService: DepartmentManagerService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async create(input: CreateDepartmentInput): Promise<Department> {
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();
    this.assertNonEmpty(name, 'Department name');

    await this.assertCodeAvailable(code);

    if (input.managerReference) {
      throw new BadRequestException(
        'Assign a manager after the department is created and employees are added',
      );
    }

    const department = this.departmentRepository.create({
      name,
      code,
      isActive: input.isActive ?? true,
    });

    const saved = await this.departmentRepository.save(department);
    return this.departmentQueryService.findOne(saved.reference);
  }

  async update(
    reference: string,
    input: UpdateDepartmentInput,
    actorId?: number,
  ): Promise<Department> {
    const department = await this.departmentQueryService.findOne(reference);

    if (input.name !== undefined) {
      const name = input.name.trim();
      this.assertNonEmpty(name, 'Department name');
      department.name = name;
    }

    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
      if (code !== department.code) {
        await this.assertCodeAvailable(code, department.id);
      }
      department.code = code;
    }

    if (input.isActive !== undefined) {
      department.isActive = input.isActive;
    }

    let nextManagerId: number | null | undefined;
    let nextManagerReference: string | null | undefined;
    if (input.managerReference !== undefined) {
      if (input.managerReference === null) {
        nextManagerId = null;
        nextManagerReference = null;
      } else {
        const manager = await findEntityByReference(
          this.userRepository,
          input.managerReference,
          'Manager not found',
        );
        this.departmentManagerService.assertManagerIsDepartmentMember(
          department.id,
          manager,
        );
        nextManagerId = manager.id;
        nextManagerReference = manager.reference;
      }
    }

    const currentManagerId = department.managerId ?? null;
    const previousManagerReference = department.manager?.reference ?? null;
    const managerChanged =
      nextManagerId !== undefined && nextManagerId !== currentManagerId;

    const departmentPatch: Partial<
      Pick<Department, 'name' | 'code' | 'isActive'>
    > = {};
    if (input.name !== undefined) {
      departmentPatch.name = department.name;
    }
    if (input.code !== undefined) {
      departmentPatch.code = department.code;
    }
    if (input.isActive !== undefined) {
      departmentPatch.isActive = department.isActive;
    }

    if (managerChanged) {
      if (nextManagerId === null) {
        await this.departmentManagerService.assertManagerCanBeCleared(
          department.id,
        );
      }

      await this.departmentRepository.manager.transaction(async (em) => {
        await this.departmentManagerService.applyManagerChange(
          em,
          department.id,
          nextManagerId ?? null,
          actorId,
        );
        await em.getRepository(Department).update(
          { id: department.id },
          {
            ...departmentPatch,
            managerId: nextManagerId ?? null,
          },
        );
      });

      await this.departmentManagerService.invalidateAuthContextForManagerIds(
        currentManagerId,
        nextManagerId ?? null,
      );

      this.emitManagerChanged({
        actorUserId: actorId,
        departmentId: department.id,
        departmentReference: department.reference,
        previousManagerId: currentManagerId,
        nextManagerId: nextManagerId ?? null,
        previousManagerReference,
        nextManagerReference: nextManagerReference ?? null,
      });
    } else if (Object.keys(departmentPatch).length > 0) {
      await this.departmentRepository.update(
        { id: department.id },
        departmentPatch,
      );
    }

    return this.departmentQueryService.findOne(reference);
  }

  async remove(reference: string): Promise<void> {
    const department = await this.departmentQueryService.findOne(reference);
    const assignedCount = await this.userRepository.count({
      where: { departmentId: department.id },
    });
    if (assignedCount > 0) {
      throw new ConflictException(
        'Cannot delete a department that has assigned users',
      );
    }
    await this.departmentRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Department);

      await repository.update({ id: department.id }, { isActive: false });
      await repository.softDelete({
        id: department.id,
      });
    });
  }

  private emitManagerChanged(event: DepartmentManagerChangedEvent): void {
    void this.domainEventPublisher.publish(
      DEPARTMENT_MANAGER_CHANGED_EVENT,
      event,
    );
  }

  private async assertCodeAvailable(
    code: string,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.departmentRepository
      .createQueryBuilder('department')
      .where('department.code = :code', { code });

    if (excludeId) {
      qb.andWhere('department.id != :excludeId', {
        excludeId,
      });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException('Department code already exists');
    }
  }

  private assertNonEmpty(value: string, label: string): void {
    if (!value.trim()) {
      throw new BadRequestException(`${label} cannot be empty`);
    }
  }
}
