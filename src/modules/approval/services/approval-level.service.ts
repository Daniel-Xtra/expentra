import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { Expense } from 'src/database/entities/expense.entity';
import { Role } from 'src/database/entities/role.entity';
import { escapeLikePattern, ilikeTerm } from 'src/core/utils/helper';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import type { IApprovalLevelService } from '../contracts/approval-level.contract';
import { ApprovalLevelCatalogService } from './approval-level-catalog.service';
import type {
  CreateApprovalLevelInput,
  ListApprovalLevelsQuery,
  PaginatedApprovalLevelsResult,
  UpdateApprovalLevelInput,
} from '../types/approval-level.types';
import type {
  ApprovalLevelHealthWarning,
  ApprovalLevelImpactSummary,
  ApprovalLevelStatusCounts,
  ApprovalLevelWorkflowHealth,
} from '../types/approval-level-response.types';
import { buildApprovalLevelExportCsv } from '../utils/approval-level-export.util';

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class ApprovalLevelService implements IApprovalLevelService {
  constructor(
    @InjectRepository(ApprovalLevel)
    private readonly approvalLevelRepository: Repository<ApprovalLevel>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(ExpenseApproval)
    private readonly expenseApprovalRepository: Repository<ExpenseApproval>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly approvalLevelCatalog: ApprovalLevelCatalogService,
  ) {}

  async create(input: CreateApprovalLevelInput): Promise<ApprovalLevel> {
    const name = input.name.trim();
    this.assertNonEmpty(name, 'Approval level name');
    const approverType = input.approverType;
    const role = await this.resolveRoleForApproverType(
      approverType,
      input.roleReference,
    );
    await this.assertLevelAvailable(input.level);
    const { minimumAmount, maximumAmount } = this.resolveAmountRange({
      minimumAmount: input.minimumAmount,
      maximumAmount: input.maximumAmount,
    });

    const approvalLevel = this.approvalLevelRepository.create({
      approverType,
      roleId: role?.id ?? null,
      role: role ?? undefined,
      name,
      level: input.level,
      minimumAmount,
      maximumAmount,
      isActive: input.isActive ?? true,
      description: input.description?.trim() ?? null,
    });

    return this.saveWithRole(approvalLevel);
  }

  async findAllApprovalLevels(
    query: ListApprovalLevelsQuery,
  ): Promise<PaginatedApprovalLevelsResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.approvalLevelRepository
      .createQueryBuilder('approvalLevel')
      .leftJoinAndSelect('approvalLevel.role', 'role')
      .orderBy('approvalLevel.level', 'ASC');

    if (query.isActive !== undefined) {
      qb.andWhere({ isActive: query.isActive });
    }

    if (query.approverType) {
      qb.andWhere('approvalLevel.approverType = :approverType', {
        approverType: query.approverType,
      });
    }

    if (query.roleReference) {
      const role = await findEntityByReference(
        this.roleRepository,
        query.roleReference,
        'Role not found',
      );
      qb.andWhere('approvalLevel.roleId = :roleId', {
        roleId: role.id,
      });
    }

    if (query.search?.trim()) {
      const term = ilikeTerm(query.search.trim());
      qb.andWhere(
        "(approvalLevel.reference ILIKE :term ESCAPE '\\' OR approvalLevel.name ILIKE :term ESCAPE '\\' OR role.name ILIKE :term ESCAPE '\\' OR approvalLevel.description ILIKE :term ESCAPE '\\')",
        { term },
      );
    }

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

  private async getStatusCounts(): Promise<ApprovalLevelStatusCounts> {
    const rows = await this.approvalLevelRepository
      .createQueryBuilder('approvalLevel')
      .select('COUNT(*)::int', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE approvalLevel.isActive = TRUE)::int',
        'active',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE approvalLevel.isActive = FALSE)::int',
        'inactive',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE approvalLevel.approverType = :deptType)::int`,
        'departmentManager',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE approvalLevel.approverType = :financeType)::int`,
        'financeManager',
      )
      .setParameters({
        deptType: ApprovalApproverType.DEPARTMENT_MANAGER,
        financeType: ApprovalApproverType.FINANCE_MANAGER,
      })
      .getRawOne<ApprovalLevelStatusCounts>();

    return (
      rows ?? {
        total: 0,
        active: 0,
        inactive: 0,
        departmentManager: 0,
        financeManager: 0,
      }
    );
  }

  async getWorkflowHealth(): Promise<ApprovalLevelWorkflowHealth> {
    const counts = await this.getStatusCounts();
    const activeLevels = await this.approvalLevelRepository.find({
      where: { isActive: true },
      relations: { role: true },
      order: { level: 'ASC' },
    });

    return {
      counts,
      warnings: this.buildWorkflowWarnings(activeLevels),
    };
  }

  async getImpactSummary(
    reference: string,
  ): Promise<ApprovalLevelImpactSummary> {
    const approvalLevel = await this.findOne(reference);
    const [historicalDecisionCount, pendingExpenseCount] = await Promise.all([
      this.expenseApprovalRepository.count({
        where: { approvalLevelId: approvalLevel.id },
      }),
      this.countPendingImpact(approvalLevel),
    ]);

    return {
      pendingExpenseCount,
      historicalDecisionCount,
    };
  }

  async buildApprovalLevelsExportCsv(
    query: ListApprovalLevelsQuery,
  ): Promise<string> {
    const result = await this.findAllApprovalLevels({
      ...query,
      page: 1,
      limit: EXPORT_ROW_LIMIT,
    });
    return buildApprovalLevelExportCsv(result.data);
  }

  async findOne(reference: string): Promise<ApprovalLevel> {
    const resolved = await findEntityByReference(
      this.approvalLevelRepository,
      reference,
      'Approval level not found',
    );
    const approvalLevel = await this.approvalLevelRepository.findOne({
      where: { id: resolved.id },
      relations: { role: true },
    });
    if (!approvalLevel) {
      throw new NotFoundException('Approval level not found');
    }
    return approvalLevel;
  }

  async update(
    reference: string,
    input: UpdateApprovalLevelInput,
  ): Promise<ApprovalLevel> {
    const approvalLevel = await this.findOne(reference);
    const nextApproverType = input.approverType ?? approvalLevel.approverType;

    if (input.approverType !== undefined) {
      approvalLevel.approverType = input.approverType;
    }

    if (input.roleReference !== undefined || input.approverType !== undefined) {
      const role = await this.resolveRoleForApproverType(
        nextApproverType,
        input.roleReference ?? approvalLevel.role?.reference,
      );
      approvalLevel.roleId = role?.id ?? null;
      approvalLevel.role = role ?? undefined;
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      this.assertNonEmpty(name, 'Approval level name');
      approvalLevel.name = name;
    }

    if (input.level !== undefined) {
      if (input.level !== approvalLevel.level) {
        await this.assertLevelAvailable(input.level, approvalLevel.id);
      }
      approvalLevel.level = input.level;
    }

    if (
      input.minimumAmount !== undefined ||
      input.maximumAmount !== undefined
    ) {
      const resolved = this.resolveAmountRange({
        minimumAmount: input.minimumAmount ?? approvalLevel.minimumAmount,
        maximumAmount:
          input.maximumAmount !== undefined
            ? input.maximumAmount
            : approvalLevel.maximumAmount,
      });
      approvalLevel.minimumAmount = resolved.minimumAmount;
      approvalLevel.maximumAmount = resolved.maximumAmount;
    }

    if (input.isActive !== undefined) {
      approvalLevel.isActive = input.isActive;
    }

    if (input.description !== undefined) {
      approvalLevel.description = input.description?.trim() ?? null;
    }

    return this.saveWithRole(approvalLevel);
  }

  async remove(reference: string): Promise<void> {
    const approvalLevel = await this.findOne(reference);

    const inUse = await this.expenseApprovalRepository.exists({
      where: {
        approvalLevelId: approvalLevel.id,
      },
    });
    if (inUse) {
      throw new ConflictException(
        'Cannot delete an approval level that has expense decisions recorded',
      );
    }

    await this.approvalLevelRepository.remove(approvalLevel);
    this.approvalLevelCatalog.invalidate();
  }

  private async resolveRoleForApproverType(
    approverType: ApprovalApproverType,
    roleReference?: string,
  ): Promise<Role | null> {
    if (approverType === ApprovalApproverType.DEPARTMENT_MANAGER) {
      return null;
    }

    if (!roleReference) {
      throw new BadRequestException(
        'roleReference is required for finance manager approval levels',
      );
    }

    return this.findRoleByReference(roleReference);
  }

  private async findRoleByReference(roleReference: string): Promise<Role> {
    return findEntityByReference(
      this.roleRepository,
      roleReference,
      'Role not found',
    );
  }

  private async assertLevelAvailable(
    level: number,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.approvalLevelRepository.findOne({
      where: { level },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `An approval level with chain order ${level} already exists`,
      );
    }
  }

  private async saveWithRole(
    approvalLevel: ApprovalLevel,
  ): Promise<ApprovalLevel> {
    const saved = await this.approvalLevelRepository.save(approvalLevel);
    this.approvalLevelCatalog.invalidate();
    return this.findOne(saved.reference);
  }

  private async countPendingImpact(level: ApprovalLevel): Promise<number> {
    const statuses =
      level.approverType === ApprovalApproverType.DEPARTMENT_MANAGER
        ? [ExpenseStatus.SUBMITTED]
        : [ExpenseStatus.UNDER_REVIEW];

    return this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin(
        'expense.approvals',
        'decision',
        'decision.approvalLevelId = :levelId',
        { levelId: level.id },
      )
      .where('expense.status IN (:...statuses)', { statuses })
      .andWhere('decision.id IS NULL')
      .getCount();
  }

  private buildWorkflowWarnings(
    activeLevels: ApprovalLevel[],
  ): ApprovalLevelHealthWarning[] {
    const warnings: ApprovalLevelHealthWarning[] = [];

    if (activeLevels.length === 0) {
      warnings.push({
        code: 'NO_ACTIVE_LEVELS',
        title: 'No active approval levels',
        description:
          'Expenses will auto-approve until at least one approval level is active.',
        destructive: true,
      });
      return warnings;
    }

    const hasFinanceLevel = activeLevels.some(
      (level) => level.approverType === ApprovalApproverType.FINANCE_MANAGER,
    );
    if (!hasFinanceLevel) {
      warnings.push({
        code: 'NO_FINANCE_LEVEL',
        title: 'No active finance approval level',
        description:
          'Add an active finance manager level so expenses can complete finance review.',
        destructive: true,
      });
    }

    const hasDepartmentManagerLevel = activeLevels.some(
      (level) => level.approverType === ApprovalApproverType.DEPARTMENT_MANAGER,
    );
    if (!hasDepartmentManagerLevel) {
      warnings.push({
        code: 'NO_DEPARTMENT_MANAGER_LEVEL',
        title: 'No department manager level',
        description:
          'Consider adding a department manager step for first-line review before finance.',
      });
    }

    const financeWithoutRole = activeLevels.filter(
      (level) =>
        level.approverType === ApprovalApproverType.FINANCE_MANAGER &&
        !level.roleId,
    );
    if (financeWithoutRole.length > 0) {
      warnings.push({
        code: 'FINANCE_LEVEL_MISSING_ROLE',
        title: 'Finance level missing role assignment',
        description: `${financeWithoutRole.map((level) => level.name).join(', ')} cannot route approvals without a finance role.`,
        destructive: true,
      });
    }

    const levelNumbers = activeLevels
      .map((level) => level.level)
      .sort((a, b) => a - b);
    for (let index = 1; index < levelNumbers.length; index += 1) {
      const previous = levelNumbers[index - 1];
      const current = levelNumbers[index];
      if (current - previous > 1) {
        warnings.push({
          code: 'LEVEL_NUMBER_GAP',
          title: 'Gap in approval level order',
          description: `Active levels jump from ${previous} to ${current}. Consider using consecutive order numbers for clarity.`,
        });
        break;
      }
    }

    return warnings;
  }

  private resolveAmountRange(input: {
    minimumAmount?: number;
    maximumAmount?: number | null;
  }): { minimumAmount: number; maximumAmount: number | null } {
    const minimumAmount = input.minimumAmount ?? 0;
    const maximumAmount = input.maximumAmount ?? null;

    if (minimumAmount < 0) {
      throw new BadRequestException('Minimum amount cannot be negative');
    }

    if (maximumAmount != null && maximumAmount < minimumAmount) {
      throw new BadRequestException(
        'Maximum amount must be greater than or equal to minimum amount',
      );
    }

    return { minimumAmount, maximumAmount };
  }

  private assertNonEmpty(value: string, label: string): void {
    if (!value) {
      throw new BadRequestException(`${label} is required`);
    }
  }
}
