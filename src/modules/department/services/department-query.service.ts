import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { DepartmentManagerHistory } from 'src/database/entities/department-manager-history.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { User } from 'src/database/entities/user.entity';
import { escapeLikePattern, ilikeTerm } from 'src/core/utils/helper';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import type {
  ListDepartmentManagerHistoryQuery,
  ListDepartmentsQuery,
  ListDepartmentUsersQuery,
  PaginatedDepartmentManagerHistoryResult,
  PaginatedDepartmentsResult,
  PaginatedDepartmentUsersResult,
} from '../types/department.types';
import type {
  DepartmentDetailSummary,
  DepartmentListExtras,
} from '../types/department-response.types';
import { fetchDepartmentExpenseStats } from '../queries/department-expense-stats.query';
import { buildDepartmentListExportCsv } from '../utils/department-export.util';
import { toDepartmentResponse } from '../mappers/department-response.mapper';

const PENDING_APPROVAL_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
] as const;

const NEAR_LIMIT_THRESHOLD_PERCENT = 80;
const EXPORT_ROW_LIMIT = 5000;

const DEPARTMENT_HEADCOUNT_SQL = `(SELECT COUNT(*)::int FROM users u WHERE u.department_id = department.id AND u.deleted_at IS NULL)`;
const DEPARTMENT_PENDING_APPROVAL_COUNT_SQL = `(SELECT COUNT(*)::int FROM expenses e LEFT JOIN users eu ON eu.id = e.user_id WHERE e.status IN ('SUBMITTED','UNDER_REVIEW') AND (e.department_id = department.id OR eu.department_id = department.id))`;

@Injectable()
export class DepartmentQueryService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(DepartmentManagerHistory)
    private readonly managerHistoryRepository: Repository<DepartmentManagerHistory>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async findAllDepartments(
    query: ListDepartmentsQuery,
  ): Promise<PaginatedDepartmentsResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const year = query.year ?? new Date().getUTCFullYear();
    const sortOrder = query.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const qb = this.departmentRepository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.manager', 'manager')
      .leftJoin(
        DepartmentBudget,
        'budget',
        'budget.department_id = department.id AND budget.year = :year AND budget.is_active = true AND budget.deleted_at IS NULL',
        { year },
      )
      .where('department.deleted_at IS NULL');

    qb.addSelect(DEPARTMENT_HEADCOUNT_SQL, 'headcount');
    qb.addSelect(
      DEPARTMENT_PENDING_APPROVAL_COUNT_SQL,
      'pending_approval_count',
    );
    qb.addSelect('budget.utilizationPercent', 'utilization_percent');
    qb.addSelect('budget.isOverBudget', 'is_over_budget');
    qb.addSelect('budget.id', 'budget_id');

    if (query.isActive !== undefined) {
      qb.andWhere('department.is_active = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.search?.trim()) {
      const term = ilikeTerm(query.search.trim());
      qb.andWhere(
        "(department.reference ILIKE :term ESCAPE '\\' OR department.name ILIKE :term ESCAPE '\\' OR department.code ILIKE :term ESCAPE '\\')",
        { term },
      );
    }

    if (query.missingManager === true) {
      qb.andWhere('department.manager_id IS NULL');
    }

    if (query.healthFilter === 'over_budget') {
      qb.andWhere('budget.is_over_budget = TRUE');
    } else if (query.healthFilter === 'near_limit') {
      qb.andWhere('budget.is_over_budget = FALSE').andWhere(
        'budget.utilization_percent >= :nearLimitThreshold',
        { nearLimitThreshold: NEAR_LIMIT_THRESHOLD_PERCENT },
      );
    } else if (query.healthFilter === 'within_limit') {
      qb.andWhere('budget.id IS NOT NULL')
        .andWhere('budget.is_over_budget = FALSE')
        .andWhere('budget.utilization_percent < :nearLimitThreshold', {
          nearLimitThreshold: NEAR_LIMIT_THRESHOLD_PERCENT,
        });
    }

    const total = await qb.getCount();

    switch (query.sortBy) {
      case 'createdAt':
        qb.orderBy('department.createdAt', sortOrder);
        break;
      case 'headcount':
        qb.orderBy('headcount', sortOrder);
        break;
      case 'utilizationPercent':
        qb.orderBy('utilization_percent', sortOrder, 'NULLS LAST');
        break;
      case 'pendingApprovals':
        qb.orderBy('pending_approval_count', sortOrder);
        break;
      default:
        qb.orderBy('department.name', sortOrder);
    }

    qb.skip(skip).take(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    const extrasByDepartmentId = this.mapDepartmentListExtras(entities, raw);

    return {
      data: entities,
      extrasByDepartmentId,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async buildDepartmentsExportCsv(
    query: ListDepartmentsQuery,
  ): Promise<string> {
    const result = await this.findAllDepartments({
      ...query,
      page: 1,
      limit: EXPORT_ROW_LIMIT,
    });
    return buildDepartmentListExportCsv(
      result.data,
      result.extrasByDepartmentId,
    );
  }

  async getDepartmentDetailSummary(
    reference: string,
  ): Promise<DepartmentDetailSummary> {
    const department = await this.findOne(reference);
    const pendingApprovalCount = await this.countPendingApprovals(
      department.id,
    );
    const year = new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));

    const statsRow = await fetchDepartmentExpenseStats(
      this.departmentRepository.manager,
      department.id,
      yearStart,
    );

    const headcount = await this.userRepository.count({
      where: { departmentId: department.id, deletedAt: IsNull() },
    });

    const recentExpenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.user', 'user')
      .where(
        '(expense.departmentId = :departmentId OR user.departmentId = :departmentId)',
        { departmentId: department.id },
      )
      .andWhere('expense.status != :draftStatus', {
        draftStatus: ExpenseStatus.DRAFT,
      })
      .orderBy('expense.updatedAt', 'DESC')
      .take(8)
      .getMany();

    return {
      department: toDepartmentResponse(department, {
        pendingApprovalCount,
        headcount,
      }),
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
        submitterName: expense.user
          ? [expense.user.firstName, expense.user.lastName]
              .filter(Boolean)
              .join(' ')
              .trim() || expense.user.email
          : null,
      })),
    };
  }

  private mapDepartmentListExtras(
    entities: Department[],
    raw: Record<string, unknown>[],
  ): Map<number, DepartmentListExtras> {
    const extrasByDepartmentId = new Map<number, DepartmentListExtras>();

    entities.forEach((department, index) => {
      const row = raw[index] ?? {};
      const utilizationRaw =
        row.utilization_percent ??
        row.utilizationPercent ??
        row.budget_utilization_percent;
      const utilization =
        utilizationRaw != null && utilizationRaw !== ''
          ? parseFloat(String(utilizationRaw))
          : null;
      const isOverBudget =
        row.is_over_budget === true ||
        row.is_over_budget === 't' ||
        row.isOverBudget === true ||
        row.isOverBudget === 't' ||
        row.budget_is_over_budget === true;
      const budgetId = row.budget_id ?? row.budgetId;
      const hasBudget = budgetId != null;
      const isNearLimit =
        hasBudget &&
        !isOverBudget &&
        utilization != null &&
        utilization >= NEAR_LIMIT_THRESHOLD_PERCENT;

      extrasByDepartmentId.set(department.id, {
        headcount: parseInt(String(row.headcount ?? '0'), 10) || 0,
        pendingApprovalCount:
          parseInt(
            String(row.pending_approval_count ?? row.pendingApprovalCount ?? '0'),
            10,
          ) || 0,
        hasBudget,
        utilizationPercent: utilization,
        isOverBudget,
        isNearLimit,
      });
    });

    return extrasByDepartmentId;
  }

  async findOne(reference: string): Promise<Department> {
    const resolved = await findEntityByReference(
      this.departmentRepository,
      reference,
      'Department not found',
    );
    const department = await this.departmentRepository.findOne({
      where: { id: resolved.id, deletedAt: IsNull() },
      relations: { manager: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  async findManagedDepartments(managerId: number): Promise<Department[]> {
    return this.departmentRepository.find({
      where: { managerId, isActive: true, deletedAt: IsNull() },
      relations: { manager: true },
      order: { name: 'ASC' },
    });
  }

  async findOneForManager(
    managerId: number,
    reference: string,
  ): Promise<Department> {
    const department = await this.findOne(reference);
    if (department.managerId !== managerId) {
      throw new ForbiddenException('You can only view departments you manage');
    }
    return department;
  }

  async findDepartmentUsers(
    reference: string,
    query: ListDepartmentUsersQuery,
  ): Promise<PaginatedDepartmentUsersResult> {
    const department = await this.findOne(reference);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.deletedAt IS NULL')
      .andWhere(
        new Brackets((where) => {
          where.where('user.departmentId = :departmentId', {
            departmentId: department.id,
          });
          if (department.managerId != null) {
            where.orWhere('user.id = :managerId', {
              managerId: department.managerId,
            });
          }
        }),
      );

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        "(user.reference ILIKE :term ESCAPE '\\' OR user.email ILIKE :term ESCAPE '\\' OR user.firstName ILIKE :term ESCAPE '\\' OR user.lastName ILIKE :term ESCAPE '\\')",
        { term: ilikeTerm(search) },
      );
    }

    qb.orderBy('user.firstName', 'ASC')
      .addOrderBy('user.lastName', 'ASC')
      .addOrderBy('user.email', 'ASC');

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

  async findManagerHistory(
    reference: string,
    query: ListDepartmentManagerHistoryQuery,
  ): Promise<PaginatedDepartmentManagerHistoryResult> {
    const department = await this.findOne(reference);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await this.managerHistoryRepository.findAndCount({
      where: { departmentId: department.id },
      relations: { manager: true, assignedBy: true },
      order: { startedAt: 'DESC' },
      skip,
      take: limit,
    });

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

  async countPendingApprovals(departmentId: number): Promise<number> {
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

  async countPendingApprovalsForDepartments(
    departmentIds: number[],
  ): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (departmentIds.length === 0) {
      return counts;
    }

    for (const departmentId of departmentIds) {
      counts.set(departmentId, 0);
    }

    const rows = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.user', 'expenseOwner')
      .select('expense.departmentId', 'expenseDepartmentId')
      .addSelect('expenseOwner.departmentId', 'ownerDepartmentId')
      .where('expense.status IN (:...statuses)', {
        statuses: PENDING_APPROVAL_STATUSES,
      })
      .andWhere(
        '(expense.departmentId IN (:...departmentIds) OR expenseOwner.departmentId IN (:...departmentIds))',
        { departmentIds },
      )
      .getRawMany<{
        expenseDepartmentId: string | number | null;
        ownerDepartmentId: string | number | null;
      }>();

    for (const row of rows) {
      const departmentId = Number(
        row.expenseDepartmentId ?? row.ownerDepartmentId,
      );
      if (!Number.isFinite(departmentId) || !counts.has(departmentId)) {
        continue;
      }
      counts.set(departmentId, (counts.get(departmentId) ?? 0) + 1);
    }

    return counts;
  }
}
