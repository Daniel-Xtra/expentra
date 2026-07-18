import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { SYSTEM_ROLES } from 'src/database/constants/system-roles';
import { Permission } from 'src/database/entities/permission.entity';
import { Role } from 'src/database/entities/role.entity';
import { User } from 'src/database/entities/user.entity';
import { escapeLikePattern, ilikeTerm, parsePositiveIntId } from 'src/core/utils/helper';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { AuthContextCacheService } from 'src/core/auth/auth-context-cache.service';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { assertCanAssignRole } from 'src/modules/authorization/policies/role-assignment.policy';
import { PermissionAssignmentPolicy } from 'src/modules/authorization/services/permission-assignment.policy';
import type { IAuthUser } from 'src/definition';
import {
  isEntityReference,
  normalizeEntityReference,
} from 'src/database/helpers/entity-reference.util';
import type { IRoleService } from '../contracts/role.contract';
import { normalizeRoleName } from '../helpers/role-name.util';
import type {
  CreateRoleInput,
  ListRolesQuery,
  PaginatedRolesResult,
  RoleTemplateView,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from '../types/role.types';
import { findRoleTemplate, listRoleTemplates } from '../data/role-templates';
import { ROLE_PERMISSIONS_CHANGED_EVENT } from '../events/role-admin.events';

@Injectable()
export class RoleService implements IRoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authContextCache: AuthContextCacheService,
    private readonly permissionAssignmentPolicy: PermissionAssignmentPolicy,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async findTemplates(): Promise<RoleTemplateView[]> {
    return listRoleTemplates().map((template) => ({
      key: template.key,
      name: template.name,
      description: template.description,
      permissionCount: template.permissionNames.length,
    }));
  }

  async create(actor: IAuthUser, input: CreateRoleInput): Promise<Role> {
    const name = normalizeRoleName(input.name);
    this.assertValidRoleName(name);
    await this.assertNameAvailable(name);

    const role = this.roleRepository.create({
      name,
      description: input.description?.trim(),
      permissions: [],
    });

    let saved: Role;
    try {
      saved = await this.roleRepository.save(role);
    } catch (error) {
      this.rethrowDuplicateRoleName(error);
      throw error;
    }

    if (input.templateKey) {
      const template = findRoleTemplate(input.templateKey);
      if (!template) {
        throw new BadRequestException('Invalid role template');
      }

      const permissions = await this.resolvePermissionsByNames(
        template.permissionNames,
      );
      return this.setPermissions(actor, saved.reference, {
        permissionReferences: permissions.map((permission) => permission.reference),
      });
    }

    return saved;
  }

  private async resolvePermissionsByNames(
    names: readonly string[],
  ): Promise<Permission[]> {
    if (names.length === 0) {
      return [];
    }

    const permissions = await this.permissionRepository.find({
      where: { name: In([...names]), isActive: true },
    });

    const found = new Set(permissions.map((permission) => permission.name));
    const missing = names.filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Role template references unknown permissions: ${missing.join(', ')}`,
      );
    }

    return permissions;
  }

  async findAllRoles(query: ListRolesQuery): Promise<PaginatedRolesResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.roleRepository
      .createQueryBuilder('role')
      .where('role.name <> :superAdmin', {
        superAdmin: SYSTEM_ROLES.SUPER_ADMIN,
      })
      .orderBy('role.name', 'ASC');

    if (query.search?.trim()) {
      const term = ilikeTerm(query.search.trim());
      qb.andWhere(
        "(role.reference ILIKE :term ESCAPE '\\' OR role.name ILIKE :term ESCAPE '\\' OR role.description ILIKE :term ESCAPE '\\')",
        { term },
      );
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    await this.attachPermissionCounts(data);

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

  async findOne(reference: string): Promise<Role> {
    const normalized = normalizeEntityReference(reference);
    if (!isEntityReference(normalized)) {
      throw new NotFoundException('Role not found');
    }

    const role = await this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('role.reference = :reference', { reference: normalized })
      .orderBy('permission.name', 'ASC')
      .getOne();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async update(reference: string, input: UpdateRoleInput): Promise<Role> {
    const role = await this.findOne(reference);
    this.assertNotSystemRole(role, 'update');

    if (input.name !== undefined) {
      const name = normalizeRoleName(input.name);
      this.assertValidRoleName(name);
      if (name !== role.name) {
        await this.assertNameAvailable(name, role.id);
      }
      role.name = name;
    }

    if (input.description !== undefined) {
      role.description = input.description.trim();
    }

    try {
      const saved = await this.roleRepository.save(role);
      await this.invalidateUsersForRole(role.id);
      return saved;
    } catch (error) {
      this.rethrowDuplicateRoleName(error);
      throw error;
    }
  }

  async setPermissions(
    actor: IAuthUser,
    reference: string,
    input: SetRolePermissionsInput,
  ): Promise<Role> {
    const role = await this.findOne(reference);
    this.assertNotSystemRole(role, 'assign permissions to');

    const permissionReferences = [
      ...new Set(
        input.permissionReferences.map((reference) =>
          normalizeEntityReference(reference),
        ),
      ),
    ];

    const permissions: Permission[] = [];
    for (const reference of permissionReferences) {
      const permission = await findEntityByReference(
        this.permissionRepository,
        reference,
        'One or more permissions are invalid or inactive',
      );
      if (!permission.isActive) {
        throw new BadRequestException(
          'One or more permissions are invalid or inactive',
        );
      }
      permissions.push(permission);
    }

    if (permissions.length !== permissionReferences.length) {
      throw new BadRequestException(
        'One or more permissions are invalid or inactive',
      );
    }

    this.permissionAssignmentPolicy.assertCanAssignPermissions(
      actor,
      permissions,
    );

    const existingPermissions = role.permissions ?? [];
    await this.roleRepository
      .createQueryBuilder()
      .relation(Role, 'permissions')
      .of(role)
      .addAndRemove(permissions, existingPermissions);

    const affectedUsers = await this.userRepository.find({
      where: { roleId: role.id },
      select: { reference: true },
    });
    await this.authContextCache.invalidateMany(
      affectedUsers.map((user) => user.reference),
    );

    void this.domainEventPublisher.publish(ROLE_PERMISSIONS_CHANGED_EVENT, {
      actorUserId: actor.id,
      roleReference: role.reference,
      permissionNames: permissions.map((permission) => permission.name),
    });

    return this.findOne(reference);
  }

  async applyTemplate(
    actor: IAuthUser,
    reference: string,
    templateKey: string,
  ): Promise<Role> {
    const template = findRoleTemplate(templateKey);
    if (!template) {
      throw new BadRequestException('Invalid role template');
    }

    const permissions = await this.resolvePermissionsByNames(
      template.permissionNames,
    );

    return this.setPermissions(actor, reference, {
      permissionReferences: permissions.map((permission) => permission.reference),
    });
  }

  async remove(reference: string): Promise<void> {
    const role = await this.findOne(reference);
    this.assertNotSystemRole(role, 'delete');

    const assignedCount = await this.userRepository.count({
      where: { roleId: role.id },
    });
    if (assignedCount > 0) {
      throw new ConflictException(
        'Cannot delete a role that has assigned users',
      );
    }

    await this.roleRepository.softDelete(role.id);
    await this.invalidateUsersForRole(role.id);
  }

  private async invalidateUsersForRole(roleId: number): Promise<void> {
    const affectedUsers = await this.userRepository.find({
      where: { roleId },
      select: { reference: true },
    });
    if (affectedUsers.length === 0) {
      return;
    }
    await this.authContextCache.invalidateMany(
      affectedUsers.map((user) => user.reference),
    );
  }

  async findAllPermissions(): Promise<Permission[]> {
    return (
      this.permissionRepository
        .createQueryBuilder('permission')
        .leftJoinAndSelect('permission.parentPermission', 'parentPermission')
        .orderBy('parentPermission.displayName', 'ASC')
        .addOrderBy('permission.displayName', 'ASC')
        // .addOrderBy('permission.resource', 'ASC')
        // .addOrderBy('permission.action', 'ASC')
        // .addOrderBy('permission.scope', 'ASC')
        .getMany()
    );
  }

  private async attachPermissionCounts(roles: Role[]): Promise<void> {
    if (roles.length === 0) {
      return;
    }

    const countRows = await this.roleRepository.manager
      .createQueryBuilder()
      .select('rp.role_id', 'roleId')
      .addSelect('COUNT(rp.permission_id)', 'permissionCount')
      .from('role_permissions', 'rp')
      .where('rp.role_id IN (:...roleIds)', {
        roleIds: roles.map((role) => role.id),
      })
      .groupBy('rp.role_id')
      .getRawMany<{ roleId: string; permissionCount: string }>();

    const countByRoleId = new Map(
      countRows.map((row) => [Number(row.roleId), Number(row.permissionCount)]),
    );

    for (const role of roles) {
      (role as Role & { permissionCount: number }).permissionCount =
        countByRoleId.get(role.id) ?? 0;
    }
  }

  private async assertNameAvailable(
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.roleRepository
      .createQueryBuilder('role')
      .where('role.name = :name', { name });

    if (excludeId) {
      qb.andWhere('role.id != :excludeId', {
        excludeId,
      });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException('Role name already exists');
    }
  }

  private assertNotSystemRole(role: Role, action: string): void {
    if (role.name === SYSTEM_ROLES.SUPER_ADMIN) {
      throw new ForbiddenException(`Cannot ${action} the super admin role`);
    }
  }

  private assertValidRoleName(name: string): void {
    if (!name) {
      throw new BadRequestException('Role name cannot be empty');
    }
  }

  private rethrowDuplicateRoleName(error: unknown): void {
    if (!(error instanceof QueryFailedError)) {
      return;
    }

    const driverError = error.driverError as { code?: string };
    if (driverError?.code === '23505') {
      throw new ConflictException('Role name already exists');
    }
  }

  private normalizeId(id: string | number): number {
    return parsePositiveIntId(id, 'role id');
  }
}
