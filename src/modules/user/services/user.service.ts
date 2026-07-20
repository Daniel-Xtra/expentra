import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, type EntityManager } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { User } from 'src/database/entities/user.entity';
import { Role } from 'src/database/entities/role.entity';
import {
  SYSTEM_ROLES,
  type SystemRoleName,
} from 'src/database/constants/system-roles';
import { resolveOrgGrants } from 'src/modules/authorization/org-grants/org-grant.resolver';
import { toAuthUser, PermissionScope } from 'src/modules/authorization';
import { assertCanAssignRole } from 'src/modules/authorization/policies/role-assignment.policy';
import type { IAuthUser } from 'src/definition';
import type { IUserService } from '../contracts/user.contract';
import type {
  AdminUpdateUserInput,
  CreateUserWithHashInput,
  ListUsersQuery,
  PaginatedUsersResult,
  SuspendUserInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from '../types/user.types';
import type {
  UserDetailSummary,
  UserStatusCounts,
} from '../types/user-response.types';
import { fetchUserExpenseStats } from '../queries/user-expense-stats.query';
import { buildUserListExportCsv } from '../utils/user-export.util';
import {
  toDepartmentRefs,
  toUserResponse,
} from '../mappers/user-response.mapper';
import { escapeLikePattern, ilikeTerm } from 'src/core/utils/helper';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { UserDepartmentChangeService } from './user-department-change.service';
import { USER_ROLE_CHANGED_EVENT } from '../events/user-role.events';
import {
  USER_ACTIVATED_EVENT,
  USER_SUSPENDED_EVENT,
} from '../events/user-lifecycle.events';
import { AuthContextCacheService } from 'src/core/auth/auth-context-cache.service';
import { RedisService } from 'src/core/redis/redis.service';

const EXPORT_ROW_LIMIT = 5000;

const PENDING_ON_DEACTIVATION_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
  ExpenseStatus.APPROVED,
];

@Injectable()
export class UserService implements IUserService {
  private readonly REFRESH_PREFIX = 'auth:refresh:';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly userDepartmentChangeService: UserDepartmentChangeService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly redisService: RedisService,
    private readonly authContextCache: AuthContextCacheService,
  ) {}

  async findAllUsers(query: ListUsersQuery): Promise<PaginatedUsersResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.createUserListQueryBuilder();
    await this.applyUserListFilters(qb, query);
    qb.orderBy('user.createdAt', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

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

  async getUserStatusCounts(): Promise<UserStatusCounts> {
    const [row] = await this.userRepository.manager.query<
      Array<{
        total: number;
        active: number;
        inactive: number;
        unassignedDepartment: number;
      }>
    >(`
      SELECT
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE u.is_active = TRUE)::int AS "active",
        COUNT(*) FILTER (WHERE u.is_active = FALSE)::int AS "inactive",
        COUNT(*) FILTER (WHERE u.department_id IS NULL)::int AS "unassignedDepartment"
      FROM users u
      WHERE u.deleted_at IS NULL
    `);

    return (
      row ?? {
        total: 0,
        active: 0,
        inactive: 0,
        unassignedDepartment: 0,
      }
    );
  }

  async buildUsersExportCsv(query: ListUsersQuery): Promise<string> {
    const qb = this.createUserListQueryBuilder();
    await this.applyUserListFilters(qb, query);
    qb.orderBy('user.createdAt', 'DESC');
    const users = await qb.take(EXPORT_ROW_LIMIT).getMany();
    return buildUserListExportCsv(users);
  }

  async getUserDetailSummary(reference: string): Promise<UserDetailSummary> {
    const user = await this.findOneByReference(reference);
    const managedDepartments = await this.departmentRepository.find({
      where: { managerId: user.id, isActive: true },
      select: { id: true, reference: true, name: true, code: true },
      order: { name: 'ASC' },
    });
    const isDepartmentManager = managedDepartments.length > 0;
    const departmentRefs = toDepartmentRefs(managedDepartments);
    const orgGrants = resolveOrgGrants(
      toAuthUser(user, {
        managedDepartmentIds: managedDepartments.map(
          (department) => department.id,
        ),
      }),
      departmentRefs,
    );
    const year = new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));

    const statsRow = await fetchUserExpenseStats(
      this.userRepository.manager,
      user.id,
      yearStart,
    );

    const recentExpenses = await this.expenseRepository.find({
      where: {
        userId: user.id,
        status: Not(ExpenseStatus.DRAFT),
      },
      order: { updatedAt: 'DESC' },
      take: 5,
      select: {
        reference: true,
        title: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      user: toUserResponse(user, { isDepartmentManager }),
      managedDepartments: departmentRefs,
      orgGrants,
      expenseStats: {
        year,
        totalCount: statsRow.totalCount,
        draftCount: statsRow.draftCount,
        pendingCount: statsRow.pendingCount,
        approvedCount: statsRow.approvedCount,
        rejectedCount: statsRow.rejectedCount,
        reimbursedCount: statsRow.reimbursedCount,
        totalAmountYtd: parseInt(statsRow.totalAmountYtd, 10),
        pendingReimbursementAmount: parseInt(
          statsRow.pendingReimbursementAmount,
          10,
        ),
      },
      recentExpenses: recentExpenses.map((expense) => ({
        reference: expense.reference,
        title: expense.title,
        amount: expense.amount,
        status: expense.status,
        createdAt: expense.createdAt.toISOString(),
      })),
    };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true, department: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async isUserDepartmentManager(userId: number): Promise<boolean> {
    const managerIds = await this.findDepartmentManagerUserIds([userId]);
    return managerIds.has(userId);
  }

  async findDepartmentManagerUserIds(userIds: number[]): Promise<Set<number>> {
    const uniqueIds = [...new Set(userIds.filter((id) => id > 0))];
    if (uniqueIds.length === 0) {
      return new Set();
    }

    const rows = await this.departmentRepository
      .createQueryBuilder('department')
      .select('department.managerId', 'managerId')
      .where('department.managerId IN (:...userIds)', { userIds: uniqueIds })
      .andWhere('department.isActive = :isActive', { isActive: true })
      .andWhere('department.deletedAt IS NULL')
      .getRawMany<{ managerId: number }>();

    return new Set(rows.map((row) => Number(row.managerId)));
  }

  async findOneByReference(reference: string): Promise<User> {
    return findEntityByReference(
      this.userRepository,
      reference,
      'User not found',
    ).then(async (user) => this.findOne(user.id));
  }

  async getProfile(id: number): Promise<User> {
    return this.findOne(id);
  }

  async updateProfile(id: number, input: UpdateProfileInput): Promise<User> {
    if (!this.hasProfileFields(input)) {
      throw new BadRequestException(
        'At least one field must be provided to update your profile',
      );
    }

    const user = await this.findOne(id);

    if (input.firstName !== undefined) {
      user.firstName = input.firstName.trim() || undefined;
    }
    if (input.lastName !== undefined) {
      user.lastName = input.lastName.trim() || undefined;
    }

    return this.userRepository.save(user);
  }

  async changePassword(id: number, input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: { id: true, reference: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'This account uses single sign-on and has no local password.',
      );
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await this.updatePasswordHash(user.id, passwordHash);

    await this.authContextCache.invalidate(user.reference);
    await this.redisService.delByPattern(
      `${this.REFRESH_PREFIX}${user.reference}:*`,
    );
  }

  async adminUpdate(
    actor: IAuthUser,
    targetUserId: number,
    input: AdminUpdateUserInput,
  ): Promise<User> {
    if (!this.hasAdminUpdateFields(input)) {
      throw new BadRequestException(
        'At least one field must be provided to update a user',
      );
    }

    const user = await this.findOne(targetUserId);
    const previousDepartmentId = user.departmentId;
    const previousDepartmentReference = user.department?.reference ?? null;
    const previousRoleReference = user.role?.reference ?? null;
    const changes: Record<string, unknown> = {};

    if (input.roleReference !== undefined) {
      const role = await findEntityByReference(
        this.roleRepository,
        input.roleReference,
        'Role not found',
      );
      assertCanAssignRole(actor, role);
      user.roleId = role.id;
      user.role = role;
      changes.roleReference = role.reference;
    }

    if (input.departmentReference !== undefined) {
      if (input.departmentReference === null) {
        user.departmentId = undefined;
        user.department = undefined;
        changes.departmentReference = null;
      } else {
        const department = await findEntityByReference(
          this.departmentRepository,
          input.departmentReference,
          'Department not found',
        );
        if (!department.isActive) {
          throw new NotFoundException('Department not found');
        }
        user.departmentId = department.id;
        user.department = department;
        changes.departmentReference = department.reference;
      }
    }

    const previousIsActive = user.isActive;
    let activeStateChanged = false;

    if (input.isActive !== undefined) {
      this.assertCanChangeUserActiveState(
        actor.id,
        targetUserId,
        input.isActive,
      );
      if (user.isActive !== input.isActive) {
        user.isActive = input.isActive;
        user.deactivatedAt = input.isActive ? null : new Date();
        activeStateChanged = true;
        changes.isActive = input.isActive;
        changes.deactivatedAt = user.deactivatedAt;
      } else if (input.isActive && user.deactivatedAt) {
        user.deactivatedAt = null;
        activeStateChanged = true;
        changes.deactivatedAt = null;
      }
    }

    if (
      input.departmentReference !== undefined &&
      previousDepartmentId &&
      previousDepartmentId !== user.departmentId
    ) {
      await this.userDepartmentChangeService.assertCanLeaveDepartment(
        previousDepartmentId,
        user.id,
      );
    }

    await this.userRepository.manager.transaction(async (manager) => {
      await manager.save(user);
      if (input.departmentReference !== undefined) {
        await this.userDepartmentChangeService.applyWithinTransaction({
          manager,
          user,
          actorId: actor.id,
          previousDepartmentId,
        });
      }
    });

    await this.authContextCache.invalidate(user.reference);

    if (activeStateChanged) {
      await this.handleUserActiveStateChanged(
        user,
        previousIsActive,
        actor.id,
        targetUserId,
      );
    }

    if (
      input.departmentReference !== undefined &&
      previousDepartmentId !== user.departmentId
    ) {
      this.userDepartmentChangeService.emitDepartmentChanged({
        actorUserId: actor.id,
        userId: user.id,
        userReference: user.reference,
        previousDepartmentId,
        nextDepartmentId: user.departmentId,
        previousDepartmentReference,
        nextDepartmentReference: user.department?.reference ?? null,
      });
    }

    await this.domainEventPublisher.publish('user.admin_updated', {
      actorUserId: actor.id,
      targetUserId: targetUserId,
      changes,
    });

    if (input.roleReference !== undefined && changes.roleReference) {
      void this.domainEventPublisher.publish(USER_ROLE_CHANGED_EVENT, {
        actorUserId: actor.id,
        userReference: user.reference,
        previousRoleReference,
        nextRoleReference: changes.roleReference,
      });
    }

    return this.findOne(targetUserId);
  }

  async suspendUser(input: {
    actorId: number;
    targetUserId: number;
  }): Promise<User> {
    this.assertCanChangeUserActiveState(
      input.actorId,
      input.targetUserId,
      false,
    );

    const user = await this.findOne(input.targetUserId);
    if (!user.isActive) {
      throw new BadRequestException('User account is already suspended');
    }

    const previousIsActive = user.isActive;
    user.isActive = false;
    user.deactivatedAt = new Date();

    await this.userRepository.save(user);
    await this.authContextCache.invalidate(user.reference);
    await this.handleUserActiveStateChanged(
      user,
      previousIsActive,
      input.actorId,
      input.targetUserId,
    );

    return this.findOne(input.targetUserId);
  }

  async activateUser(input: {
    actorId: number;
    targetUserId: number;
  }): Promise<User> {
    this.assertCanChangeUserActiveState(
      input.actorId,
      input.targetUserId,
      true,
    );

    const user = await this.findOne(input.targetUserId);
    if (user.isActive && !user.deactivatedAt) {
      throw new BadRequestException('User account is already active');
    }

    const previousIsActive = user.isActive;
    user.isActive = true;
    user.deactivatedAt = null;

    await this.userRepository.save(user);
    await this.authContextCache.invalidate(user.reference);
    await this.handleUserActiveStateChanged(
      user,
      previousIsActive,
      input.actorId,
      input.targetUserId,
    );

    return this.findOne(input.targetUserId);
  }

  async findActiveUsersByRole(roleName: SystemRoleName): Promise<User[]> {
    return this.userRepository.find({
      where: {
        role: { name: roleName },
        isActive: true,
      },
      relations: { role: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return this.userRepository.findOne({
      where: { email: normalized },
      relations: { role: true },
      select: {
        id: true,
        reference: true,
        email: true,
        firstName: true,
        password: true,
        isActive: true,
        roleId: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        deactivatedAt: true,
        authProvider: true,
        externalId: true,
      },
    });
  }

  async findByExternalIdentity(
    authProvider: string,
    externalId: string,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { authProvider, externalId },
      relations: { role: true },
    });
  }

  async findAuthContext(reference: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.reference = :reference', {
        reference,
      })
      .getOne();
  }

  async findActiveUsersWithPermission(
    action: string,
    resource: string,
    scope?: PermissionScope,
  ): Promise<User[]> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .innerJoin('role.permissions', 'permission')
      .where('user.isActive = :active', { active: true })
      .andWhere('permission.isActive = :permActive', { permActive: true })
      .andWhere('permission.action = :action', { action })
      .andWhere('permission.resource = :resource', { resource });

    if (scope !== undefined) {
      qb.andWhere('permission.scope = :scope', { scope });
    }

    return qb.getMany();
  }

  async findActiveUsersForExpenseApprovalNotification(
    departmentId?: number | null,
  ): Promise<User[]> {
    if (!departmentId) {
      return [];
    }

    const department = await this.departmentRepository.findOne({
      where: { id: departmentId, isActive: true },
      relations: { manager: true },
    });

    const manager = department?.manager;
    if (!manager?.isActive) {
      return [];
    }

    return [manager];
  }

  async findManagedDepartmentIds(userId: number): Promise<number[]> {
    const departments = await this.departmentRepository.find({
      where: { managerId: userId, isActive: true },
      select: { id: true },
    });
    return departments.map((department) => department.id);
  }

  async findActiveUsersForFinanceQueueNotification(): Promise<User[]> {
    const [approvers, reimbursers] = await Promise.all([
      this.findActiveUsersWithPermission(
        'approve',
        'approval',
        PermissionScope.GLOBAL,
      ),
      this.findActiveUsersWithPermission(
        'reimburse',
        'expense',
        PermissionScope.GLOBAL,
      ),
    ]);

    return this.dedupeUsersByIdentifier([...approvers, ...reimbursers]);
  }

  private dedupeUsersByIdentifier(users: User[]): User[] {
    const seen = new Set<number>();
    return users.filter((user) => {
      if (seen.has(user.id)) {
        return false;
      }
      seen.add(user.id);
      return true;
    });
  }

  async markEmailVerified(id: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: { id: true, reference: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.update(
      { id },
      { emailVerifiedAt: new Date(), isEmailVerified: true, isActive: true },
    );
    await this.authContextCache.invalidate(user.reference);
  }

  async createWithHash(
    data: CreateUserWithHashInput,
    manager?: EntityManager,
  ): Promise<User> {
    const roleRepository = manager
      ? manager.getRepository(Role)
      : this.roleRepository;
    const userRepository = manager
      ? manager.getRepository(User)
      : this.userRepository;

    const staffRole = await roleRepository.findOne({
      where: { name: SYSTEM_ROLES.STAFF },
    });

    if (!staffRole) {
      throw new NotFoundException(
        'Default staff role is not configured. Run database seed or create the staff role before registering users.',
      );
    }

    const user = userRepository.create({
      email: data.email.trim().toLowerCase(),
      password: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      roleId: staffRole.id,
      role: staffRole,
      isActive: data.isActive,
      isEmailVerified: false,
      authProvider: 'local',
    });
    return userRepository.save(user);
  }

  async createSsoUser(data: {
    email: string;
    authProvider: string;
    externalId: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  }): Promise<User> {
    const staffRole = await this.roleRepository.findOne({
      where: { name: SYSTEM_ROLES.STAFF },
    });

    if (!staffRole) {
      throw new NotFoundException(
        'Default staff role is not configured. Run database seed or create the staff role before registering users.',
      );
    }

    const now = new Date();
    const user = this.userRepository.create({
      email: data.email.trim().toLowerCase(),
      password: null,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl ?? null,
      roleId: staffRole.id,
      role: staffRole,
      isActive: true,
      isEmailVerified: true,
      emailVerifiedAt: now,
      authProvider: data.authProvider,
      externalId: data.externalId,
    });
    return this.userRepository.save(user);
  }

  async linkSsoIdentity(
    userId: number,
    data: {
      authProvider: string;
      externalId: string;
      avatarUrl?: string | null;
    },
  ): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      {
        authProvider: data.authProvider,
        externalId: data.externalId,
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    );
  }

  async syncSsoProfile(
    userId: number,
    data: { avatarUrl?: string | null },
  ): Promise<void> {
    const avatarUrl = data.avatarUrl?.trim();
    if (!avatarUrl) {
      return;
    }

    await this.userRepository.update({ id: userId }, { avatarUrl });
  }

  async create(userData: Partial<User>): Promise<User> {
    const existingUser = await this.findByEmail(userData.email!);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  private hasProfileFields(input: UpdateProfileInput): boolean {
    return input.firstName !== undefined || input.lastName !== undefined;
  }

  private hasAdminUpdateFields(input: AdminUpdateUserInput): boolean {
    return (
      input.roleReference !== undefined ||
      input.departmentReference !== undefined ||
      input.isActive !== undefined
    );
  }

  private assertCanChangeUserActiveState(
    actorId: number,
    targetUserId: number,
    isActive: boolean,
  ): void {
    if (actorId !== targetUserId) {
      return;
    }

    if (!isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    throw new BadRequestException('You cannot activate your own account');
  }

  private async handleUserActiveStateChanged(
    user: User,
    previousIsActive: boolean,
    actorId: number,
    targetUserId: number,
  ): Promise<void> {
    if (!user.isActive) {
      await this.redisService.delByPattern(
        `${this.REFRESH_PREFIX}${user.reference}:*`,
      );

      if (previousIsActive) {
        const pendingExpenses = await this.expenseRepository.find({
          where: {
            userId: user.id,
            status: In(PENDING_ON_DEACTIVATION_STATUSES),
          },
          select: {
            reference: true,
            status: true,
            title: true,
          },
          order: { updatedAt: 'DESC' },
          take: 100,
        });

        await this.domainEventPublisher.publish(USER_SUSPENDED_EVENT, {
          actorUserId: actorId,
          targetUserId,
          userReference: user.reference,
          pendingExpenses: pendingExpenses.map((expense) => ({
            reference: expense.reference,
            status: expense.status,
            title: expense.title,
          })),
          changes: {
            isActive: false,
            deactivatedAt: user.deactivatedAt,
          },
        });
      }

      return;
    }

    if (!previousIsActive) {
      await this.domainEventPublisher.publish(USER_ACTIVATED_EVENT, {
        actorUserId: actorId,
        targetUserId,
        userReference: user.reference,
        changes: {
          isActive: true,
          deactivatedAt: null,
        },
      });
    }
  }

  private createUserListQueryBuilder() {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.deleted_at IS NULL');
  }

  private async applyUserListFilters(
    qb: ReturnType<UserService['createUserListQueryBuilder']>,
    query: ListUsersQuery,
  ): Promise<void> {
    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        "(user.reference ILIKE :term ESCAPE '\\' OR user.email ILIKE :term ESCAPE '\\' OR user.firstName ILIKE :term ESCAPE '\\' OR user.lastName ILIKE :term ESCAPE '\\')",
        { term: ilikeTerm(search) },
      );
    }

    if (query.departmentReference) {
      const department = await findEntityByReference(
        this.departmentRepository,
        query.departmentReference,
        'Department not found',
      );
      qb.andWhere('user.departmentId = :departmentId', {
        departmentId: department.id,
      });
    }

    if (query.roleReference) {
      const role = await findEntityByReference(
        this.roleRepository,
        query.roleReference,
        'Role not found',
      );
      qb.andWhere('user.roleId = :roleId', { roleId: role.id });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.unassignedDepartment) {
      qb.andWhere('user.departmentId IS NULL');
    }
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: { id: true, reference: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.update({ id }, { password: passwordHash });
    await this.authContextCache.invalidate(user.reference);
  }
}
