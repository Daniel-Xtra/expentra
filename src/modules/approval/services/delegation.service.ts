import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { ApprovalDelegation } from 'src/database/entities/approval-delegation.entity';
import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import { Department } from 'src/database/entities/department.entity';
import type { Expense } from 'src/database/entities/expense.entity';
import { User } from 'src/database/entities/user.entity';
import type { IAuthUser } from 'src/definition';
import { AccessPolicyService, toAuthUser } from 'src/modules/authorization';
import {
  compareCalendarDates,
  resolveBudgetYear,
} from 'src/modules/budget/utils/budget-period.util';
import type { IDelegationService } from '../contracts/delegation.contract';
import type { CreateDelegationInput, ListDelegationsQuery, PaginatedDelegationsResult } from '../types/delegation.types';

@Injectable()
export class DelegationService implements IDelegationService {
  constructor(
    @InjectRepository(ApprovalDelegation)
    private readonly delegationRepository: Repository<ApprovalDelegation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly accessPolicy: AccessPolicyService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly configService: ConfigService,
  ) {}

  async create(
    delegator: IAuthUser,
    input: CreateDelegationInput,
  ): Promise<ApprovalDelegation> {
    if (!this.accessPolicy.canDecideOnApproval(delegator)) {
      throw new ForbiddenException(
        'Only approvers can create approval delegations',
      );
    }

    const delegatorId = delegator.id;

    if (input.endsAt <= input.startsAt) {
      throw new BadRequestException('Delegation end must be after start');
    }

    this.assertDelegationDates(input.startsAt, input.endsAt);

    const delegate = await findEntityByReference(
      this.userRepository,
      input.delegateReference,
      'Delegate user not found',
    );

    if (delegate.id === delegatorId) {
      throw new BadRequestException('You cannot delegate approval to yourself');
    }

    if (!delegate.isActive) {
      throw new BadRequestException('Delegate user is not active');
    }

    const delegation = await this.delegationRepository.save(
      this.delegationRepository.create({
        delegatorId,
        delegateId: delegate.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isActive: true,
      }),
    );

    await this.domainEventPublisher.publish('delegation.created', {
      actorId: delegatorId,
      delegationReference: delegation.reference,
      delegateReference: delegate.reference,
    });

    return this.loadWithUsers(delegation.id);
  }

  async findMine(
    delegatorId: number,
    query: ListDelegationsQuery = {},
  ): Promise<PaginatedDelegationsResult> {
    const { page, limit, skip } = this.resolvePagination(query);

    const [data, total] = await this.delegationRepository.findAndCount({
      where: { delegatorId },
      relations: { delegator: true, delegate: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findDelegatedToMe(
    delegateId: number,
    query: ListDelegationsQuery = {},
  ): Promise<PaginatedDelegationsResult> {
    const { page, limit, skip } = this.resolvePagination(query);
    const now = new Date();

    const qb = this.delegationRepository
      .createQueryBuilder('delegation')
      .leftJoinAndSelect('delegation.delegator', 'delegator')
      .leftJoinAndSelect('delegator.role', 'delegatorRole')
      .leftJoinAndSelect('delegatorRole.permissions', 'delegatorPermissions')
      .leftJoinAndSelect('delegation.delegate', 'delegate')
      .where('delegation.delegate_id = :delegateId', { delegateId })
      .andWhere('delegation.is_active = true')
      .andWhere('delegation.starts_at <= :now', { now })
      .andWhere('delegation.ends_at >= :now', { now })
      .orderBy('delegation.createdAt', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return this.toPaginatedResult(data, page, limit, total);
  }

  async revoke(delegatorId: number, reference: string): Promise<void> {
    const delegation = await findEntityByReference(
      this.delegationRepository,
      reference,
      'Delegation not found',
    );

    if (delegation.delegatorId !== delegatorId) {
      throw new ForbiddenException('You can only revoke your own delegations');
    }

    delegation.isActive = false;
    await this.delegationRepository.save(delegation);

    await this.domainEventPublisher.publish('delegation.revoked', {
      actorId: delegatorId,
      delegationReference: delegation.reference,
    });
  }

  async canActAsDelegate(
    authUser: IAuthUser,
    expense: Expense,
    stage: ApprovalLevel,
  ): Promise<boolean> {
    const delegations = await this.findActiveDelegationsForDelegate(
      authUser.id,
    );

    for (const delegation of delegations) {
      const delegator = delegation.delegator;
      if (!delegator) {
        continue;
      }

      if (await this.delegatorCanActOnStage(delegator, expense, stage)) {
        return true;
      }
    }

    return false;
  }

  private async delegatorCanActOnStage(
    delegator: User,
    expense: Expense,
    stage: ApprovalLevel,
  ): Promise<boolean> {
    const managedDepartmentIds = await this.findManagedDepartmentIds(
      delegator.id,
    );
    const authDelegator = toAuthUser(delegator, { managedDepartmentIds });

    return this.accessPolicy.canActOnApprovalStage(
      authDelegator,
      expense,
      stage,
    );
  }

  private async findManagedDepartmentIds(userId: number): Promise<number[]> {
    const departments = await this.departmentRepository.find({
      where: { managerId: userId, isActive: true },
      select: { id: true },
    });
    return departments.map((department) => department.id);
  }

  private async findActiveDelegationsForDelegate(
    delegateId: number,
  ): Promise<ApprovalDelegation[]> {
    const now = new Date();
    return this.delegationRepository
      .createQueryBuilder('delegation')
      .leftJoinAndSelect('delegation.delegator', 'delegator')
      .leftJoinAndSelect('delegator.role', 'delegatorRole')
      .leftJoinAndSelect('delegatorRole.permissions', 'delegatorPermissions')
      .leftJoinAndSelect('delegation.delegate', 'delegate')
      .where('delegation.delegate_id = :delegateId', { delegateId })
      .andWhere('delegation.is_active = true')
      .andWhere('delegation.starts_at <= :now', { now })
      .andWhere('delegation.ends_at >= :now', { now })
      .getMany();
  }

  private resolvePagination(query: ListDelegationsQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private toPaginatedResult(
    data: ApprovalDelegation[],
    page: number,
    limit: number,
    total: number,
  ): PaginatedDelegationsResult {
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async loadWithUsers(id: number): Promise<ApprovalDelegation> {
    const delegation = await this.delegationRepository.findOne({
      where: { id },
      relations: { delegator: true, delegate: true },
    });
    if (!delegation) {
      throw new NotFoundException('Delegation not found');
    }
    return delegation;
  }

  private assertDelegationDates(startsAt: Date, endsAt: Date): void {
    const timeZone = this.configService.get<string>('BUDGET_TIMEZONE', 'UTC');
    const now = new Date();
    const currentYear = resolveBudgetYear(now, timeZone);
    const startsYear = resolveBudgetYear(startsAt, timeZone);
    const endsYear = resolveBudgetYear(endsAt, timeZone);

    if (startsYear < currentYear || endsYear < currentYear) {
      throw new BadRequestException(
        'Delegation dates cannot be before the current year',
      );
    }

    if (compareCalendarDates(startsAt, now, timeZone) < 0) {
      throw new BadRequestException('Delegation start date cannot be in the past');
    }

    if (compareCalendarDates(endsAt, now, timeZone) < 0) {
      throw new BadRequestException('Delegation end date cannot be in the past');
    }
  }
}
