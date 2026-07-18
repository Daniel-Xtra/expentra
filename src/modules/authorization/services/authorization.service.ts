import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { User } from 'src/database/entities/user.entity';
import { AbilityFactory } from '../ability/ability.factory';
import { capabilitiesFromAuthContext } from '../capabilities';
import { resolveOrgGrants } from '../org-grants/org-grant.resolver';
import { toAuthUser } from '../mappers/auth-user.mapper';
import {
  buildAccessReviewCsv,
  type AccessReviewRow,
} from '../utils/access-review-csv.util';

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async findActiveUserWithRole(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: { role: { permissions: true }, department: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async buildContextForUser(user: User) {
    const managedDepartments = await this.findManagedDepartments(user.id);
    const managedDepartmentIds = await this.findManagedDepartmentIds(user.id);
    const authUser = toAuthUser(user, { managedDepartmentIds });
    const orgGrants = resolveOrgGrants(authUser, managedDepartments);
    const abilityRules = authUser.role
      ? this.abilityFactory.createForUser(authUser).rules.map((rule) => ({
          action: rule.action,
          subject: rule.subject,
          inverted: rule.inverted ?? false,
        }))
      : [];

    return {
      reference: user.reference,
      email: user.email,
      role: user.role
        ? { reference: user.role.reference, name: user.role.name }
        : null,
      department: user.department
        ? {
            reference: user.department.reference,
            name: user.department.name,
            code: user.department.code,
          }
        : null,
      orgGrants,
      capabilities: capabilitiesFromAuthContext(authUser, orgGrants),
      abilityRules,
      managedDepartments,
    };
  }

  private async findManagedDepartments(userId: number) {
    const departments = await this.departmentRepository.find({
      where: { managerId: userId, isActive: true },
      select: { reference: true, name: true, code: true },
      order: { name: 'ASC' },
    });

    return departments.map((department) => ({
      reference: department.reference,
      name: department.name,
      code: department.code,
    }));
  }

  private async findManagedDepartmentIds(userId: number): Promise<number[]> {
    const departments = await this.departmentRepository.find({
      where: { managerId: userId, isActive: true },
      select: { id: true },
    });
    return departments.map((department) => department.id);
  }

  async buildAccessReview() {
    const users = await this.userRepository.find({
      where: { isActive: true },
      relations: { role: { permissions: true }, department: true },
      order: { email: 'ASC' },
    });

    if (users.length === 0) {
      return [];
    }

    const managerRows = await this.departmentRepository.find({
      where: { managerId: In(users.map((user) => user.id)), isActive: true },
      select: { id: true, managerId: true, reference: true, name: true },
    });

    const managedDepartmentsByUserId = new Map<
      number,
      { reference: string; name: string }[]
    >();
    const managedDepartmentIdsByUserId = new Map<number, number[]>();

    for (const department of managerRows) {
      if (!department.managerId) {
        continue;
      }
      const departments =
        managedDepartmentsByUserId.get(department.managerId) ?? [];
      departments.push({
        reference: department.reference,
        name: department.name,
      });
      managedDepartmentsByUserId.set(department.managerId, departments);

      const ids = managedDepartmentIdsByUserId.get(department.managerId) ?? [];
      ids.push(department.id);
      managedDepartmentIdsByUserId.set(department.managerId, ids);
    }

    return users.map((user) => {
      const managedDepartments = managedDepartmentsByUserId.get(user.id) ?? [];
      const managedDepartmentIds =
        managedDepartmentIdsByUserId.get(user.id) ?? [];
      const authUser = toAuthUser(user, { managedDepartmentIds });
      const orgGrants = resolveOrgGrants(authUser, managedDepartments);

      return {
        userReference: user.reference,
        email: user.email,
        roleName: user.role?.name ?? null,
        departmentName: user.department?.name ?? null,
        permissionNames:
          user.role?.permissions
            ?.filter((permission) => permission.isActive)
            .map((permission) => permission.name)
            .sort() ?? [],
        orgGrants,
        capabilities: capabilitiesFromAuthContext(authUser, orgGrants),
      };
    });
  }

  async buildAccessReviewCsv(): Promise<string> {
    const rows = await this.buildAccessReview();
    return buildAccessReviewCsv(rows as AccessReviewRow[]);
  }
}
