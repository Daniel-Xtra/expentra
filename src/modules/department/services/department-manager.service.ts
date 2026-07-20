import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { AuthContextCacheService } from 'src/core/auth/auth-context-cache.service';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentManagerHistory } from 'src/database/entities/department-manager-history.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { User } from 'src/database/entities/user.entity';

const PENDING_APPROVAL_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
] as const;

@Injectable()
export class DepartmentManagerService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly authContextCache: AuthContextCacheService,
  ) {}

  assertManagerIsDepartmentMember(departmentId: number, manager: User): void {
    if (!manager.isActive) {
      throw new NotFoundException('Manager not found');
    }
    if (manager.departmentId !== departmentId) {
      throw new BadRequestException(
        'Manager must be an employee assigned to this department',
      );
    }
  }

  async assertManagerCanLeaveDepartment(
    departmentId: number,
    userId: number,
  ): Promise<void> {
    const department = await this.departmentRepository.findOne({
      where: { id: departmentId, deletedAt: IsNull() },
      select: { id: true, managerId: true },
    });
    if (department?.managerId !== userId) {
      return;
    }

    await this.assertManagerCanBeCleared(departmentId);
  }

  async assertManagerCanBeCleared(departmentId: number): Promise<void> {
    const pendingApprovals = await this.countPendingApprovals(departmentId);
    if (pendingApprovals > 0) {
      throw new ConflictException(
        'Cannot remove the department manager while expenses are awaiting approval. Assign a replacement manager instead.',
      );
    }
  }

  async applyManagerChange(
    manager: EntityManager,
    departmentId: number,
    nextManagerId: number | null,
    actorId?: number,
  ): Promise<void> {
    const historyRepository = manager.getRepository(DepartmentManagerHistory);
    const now = new Date();

    await historyRepository.update(
      { departmentId, endedAt: IsNull() },
      { endedAt: now },
    );

    if (nextManagerId !== null) {
      const entry = historyRepository.create({
        departmentId,
        managerId: nextManagerId,
        assignedById: actorId ?? null,
        startedAt: now,
      });
      await historyRepository.save(entry);
    }
  }

  async releaseManagerIfUserLeftDepartment(
    departmentId: number,
    userId: number,
    actorId?: number,
    entityManager?: EntityManager,
  ): Promise<void> {
    const departmentRepository =
      entityManager?.getRepository(Department) ?? this.departmentRepository;

    const department = await departmentRepository.findOne({
      where: { id: departmentId, deletedAt: IsNull() },
    });
    if (!department || department.managerId !== userId) {
      return;
    }

    if (!entityManager) {
      await this.assertManagerCanBeCleared(departmentId);
    }

    const applyRelease = async (manager: EntityManager) => {
      await this.applyManagerChange(manager, departmentId, null, actorId);
      await manager
        .getRepository(Department)
        .update({ id: departmentId }, { managerId: null });
    };

    if (entityManager) {
      await applyRelease(entityManager);
    } else {
      await this.departmentRepository.manager.transaction(applyRelease);
    }

    await this.invalidateAuthContextForManagerIds(userId);
  }

  async invalidateAuthContextForManagerIds(
    ...managerIds: Array<number | null | undefined>
  ): Promise<void> {
    const uniqueIds = [
      ...new Set(
        managerIds.filter(
          (id): id is number => typeof id === 'number' && id > 0,
        ),
      ),
    ];
    if (uniqueIds.length === 0) {
      return;
    }

    const users = await this.userRepository.find({
      where: { id: In(uniqueIds) },
      select: { reference: true },
    });
    await this.authContextCache.invalidateMany(
      users.map((user) => user.reference),
    );
  }

  private async countPendingApprovals(departmentId: number): Promise<number> {
    return this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.user', 'expenseOwner')
      .where('expense.status IN (:...statuses)', {
        statuses: PENDING_APPROVAL_STATUSES,
      })
      .andWhere(
        '(expense.departmentId = :departmentId OR expenseOwner.departmentId = :departmentId)',
        { departmentId },
      )
      .getCount();
  }
}
