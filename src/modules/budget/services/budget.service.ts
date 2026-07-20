import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { User } from 'src/database/entities/user.entity';
import type {
  IBudgetService,
  PaginatedBudgetsResult,
} from '../contracts/budget.contract';
import { BUDGET_COMMITTED_STATUSES } from '../constants/budget.constants';
import type {
  BudgetApproveEvaluation,
  BudgetByDepartmentRow,
  BudgetSubmitEvaluation,
  BudgetUsageSummary,
  CreateDepartmentBudgetInput,
  ListBudgetsQuery,
  OrganizationBudgetSummary,
  UpdateDepartmentBudgetInput,
} from '../types/budget.types';
import {
  applyCommittedAmountDelta,
  applyReimbursedAmountDelta,
  lockDepartmentBudgetRow,
  recalculateDepartmentBudgetCommitted,
  recalculateDepartmentBudgetReimbursed,
} from '../queries/budget-committed.query';
import { fetchCommittedByDepartment } from '../queries/budget-organization.query';
import {
  computeProjectedBudgetMetrics,
  fetchDepartmentBudgetSummary,
} from '../queries/department-budget-summary.query';
import { fetchOrganizationBudgetSummary } from 'src/modules/report/queries/organization-budget-summary.query';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { buildBudgetListExportCsv } from '../utils/budget-export.util';
import {
  budgetYearRangeInTimeZone,
  resolveBudgetYear,
} from '../utils/budget-period.util';
import { runWithConcurrency } from '../utils/run-with-concurrency.util';
import {
  countsTowardCommittedBudget,
  expenseBudgetAttributionChanged,
  isReimbursementTransition,
  type ExpenseBudgetSnapshot,
} from '../utils/expense-budget-sync.util';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class BudgetService implements IBudgetService {
  constructor(
    @InjectRepository(DepartmentBudget)
    private readonly budgetRepository: Repository<DepartmentBudget>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async create(input: CreateDepartmentBudgetInput): Promise<DepartmentBudget> {
    this.assertValidYear(input.year);
    this.assertCreatableBudgetYear(input.year);
    this.assertPositiveLimit(input.amountLimit);

    const department = await findEntityByReference(
      this.departmentRepository,
      input.departmentReference,
      'Department not found',
    );
    if (!department.isActive) {
      throw new NotFoundException('Department not found');
    }

    const existing = await this.budgetRepository.findOne({
      where: {
        departmentId: department.id,
        year: input.year,
      },
    });
    if (existing) {
      throw new ConflictException(
        'A budget already exists for this department and year',
      );
    }

    const budget = this.budgetRepository.create({
      departmentId: department.id,
      year: input.year,
      amountLimit: input.amountLimit,
      currency: input.currency ?? 'NGN',
      isActive: true,
    });

    const saved = await this.budgetRepository.save(budget);
    return this.findOne(saved.reference);
  }

  async update(
    reference: string,
    input: UpdateDepartmentBudgetInput,
  ): Promise<DepartmentBudget> {
    const budget = await this.findOne(reference);

    if (input.amountLimit !== undefined) {
      this.assertPositiveLimit(input.amountLimit);
      budget.amountLimit = input.amountLimit;
    }
    if (input.isActive !== undefined) {
      budget.isActive = input.isActive;
    }

    await this.budgetRepository.save(budget);
    return this.findOne(reference);
  }

  async findAllBudgets(
    query: ListBudgetsQuery,
  ): Promise<PaginatedBudgetsResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.budgetRepository
      .createQueryBuilder('budget')
      .leftJoinAndSelect('budget.department', 'department')
      .where('budget.deleted_at IS NULL');

    if (query.departmentReference) {
      const department = await findEntityByReference(
        this.departmentRepository,
        query.departmentReference,
        'Department not found',
      );
      qb.andWhere('budget.departmentId = :departmentId', {
        departmentId: department.id,
      });
    }
    if (query.year) {
      qb.andWhere('budget.year = :year', { year: query.year });
    }

    const nearLimitThreshold = this.getNearLimitThresholdPercent();
    if (query.healthFilter === 'over_budget') {
      qb.andWhere('budget.is_over_budget = TRUE');
    } else if (query.healthFilter === 'near_limit') {
      qb.andWhere('budget.is_over_budget = FALSE').andWhere(
        'budget.utilization_percent >= :nearLimitThreshold',
        { nearLimitThreshold },
      );
    } else if (query.healthFilter === 'within_limit') {
      qb.andWhere('budget.is_over_budget = FALSE').andWhere(
        'budget.utilization_percent < :nearLimitThreshold',
        { nearLimitThreshold },
      );
    }

    const sortColumn = this.resolveBudgetSortColumn(query.sortBy);
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortColumn, sortOrder);

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

  async getOrganizationSummary(
    year: number,
  ): Promise<OrganizationBudgetSummary> {
    this.assertValidYear(year);
    const timeZone = this.getBudgetTimeZone();
    const { start, end } = budgetYearRangeInTimeZone(year, timeZone);

    const row = await fetchOrganizationBudgetSummary(
      this.budgetRepository.manager,
      year,
      start,
      end,
      BUDGET_COMMITTED_STATUSES,
      ExpenseStatus.REIMBURSED,
    );

    const departmentCount = row.departmentCount;
    const amountLimit = parseInt(row.amountLimit ?? '0', 10);
    const pipelineAmount = parseInt(row.pipelineAmount ?? '0', 10);
    const reimbursedAmount = parseInt(row.reimbursedAmount ?? '0', 10);
    const committedAmount = pipelineAmount + reimbursedAmount;
    const remainingAmount = Math.max(0, amountLimit - committedAmount);
    const overBudgetAmount = Math.max(0, committedAmount - amountLimit);
    const utilizationPercent =
      amountLimit > 0
        ? Math.round((committedAmount / amountLimit) * 10000) / 100
        : 0;
    const isOverBudget = committedAmount > amountLimit;
    const nearLimitThreshold = this.getNearLimitThresholdPercent();
    const isNearLimit =
      amountLimit > 0 &&
      !isOverBudget &&
      utilizationPercent >= nearLimitThreshold;

    return {
      year,
      currency: 'NGN',
      amountLimit,
      committedAmount,
      reimbursedAmount,
      remainingAmount,
      overBudgetAmount,
      utilizationPercent,
      isOverBudget,
      isNearLimit,
      departmentCount,
      hasBudget: departmentCount > 0,
    };
  }

  async getCommittedByDepartment(
    year: number,
  ): Promise<BudgetByDepartmentRow[]> {
    this.assertValidYear(year);
    const rows = await fetchCommittedByDepartment(
      this.budgetRepository.manager,
      year,
    );

    return rows.map((row) => ({
      departmentReference: row.departmentReference,
      departmentName: row.departmentName,
      departmentCode: row.departmentCode,
      committedAmount: parseInt(row.committedAmount, 10),
      amountLimit: parseInt(row.amountLimit, 10),
      utilizationPercent: parseFloat(row.utilizationPercent),
      isOverBudget: row.isOverBudget,
    }));
  }

  async buildBudgetsExportCsv(query: ListBudgetsQuery): Promise<string> {
    const qb = this.budgetRepository
      .createQueryBuilder('budget')
      .leftJoinAndSelect('budget.department', 'department')
      .where('budget.deleted_at IS NULL');

    if (query.departmentReference) {
      const department = await findEntityByReference(
        this.departmentRepository,
        query.departmentReference,
        'Department not found',
      );
      qb.andWhere('budget.departmentId = :departmentId', {
        departmentId: department.id,
      });
    }
    if (query.year) {
      qb.andWhere('budget.year = :year', { year: query.year });
    }

    const nearLimitThreshold = this.getNearLimitThresholdPercent();
    if (query.healthFilter === 'over_budget') {
      qb.andWhere('budget.is_over_budget = TRUE');
    } else if (query.healthFilter === 'near_limit') {
      qb.andWhere('budget.is_over_budget = FALSE').andWhere(
        'budget.utilization_percent >= :nearLimitThreshold',
        { nearLimitThreshold },
      );
    } else if (query.healthFilter === 'within_limit') {
      qb.andWhere('budget.is_over_budget = FALSE').andWhere(
        'budget.utilization_percent < :nearLimitThreshold',
        { nearLimitThreshold },
      );
    }

    const sortColumn = this.resolveBudgetSortColumn(query.sortBy);
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortColumn, sortOrder);

    const budgets = await qb.take(EXPORT_ROW_LIMIT).getMany();
    return buildBudgetListExportCsv(budgets);
  }

  async findOne(reference: string): Promise<DepartmentBudget> {
    const resolved = await findEntityByReference(
      this.budgetRepository,
      reference,
      'Budget not found',
    );
    const budget = await this.budgetRepository.findOne({
      where: { id: resolved.id, deletedAt: IsNull() },
      relations: { department: true },
    });
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    return budget;
  }

  async getDepartmentSummary(
    departmentId: number,
    year: number,
  ): Promise<BudgetUsageSummary> {
    this.assertValidYear(year);
    const summary = await this.loadDepartmentBudgetSummary(departmentId, year);
    if (!summary) {
      throw new NotFoundException('Department not found');
    }
    return summary;
  }

  async getSummaryForUser(
    userId: number,
    year?: number,
  ): Promise<BudgetUsageSummary | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, departmentId: true },
    });
    if (!user?.departmentId) {
      return null;
    }

    const resolvedYear =
      year ?? resolveBudgetYear(new Date(), this.getBudgetTimeZone());

    return this.getDepartmentSummary(user.departmentId, resolvedYear);
  }

  async evaluateExpenseSubmit(
    userId: number,
    amount: number,
    submittedAt: Date = new Date(),
    departmentId?: number | null,
  ): Promise<BudgetSubmitEvaluation> {
    const resolvedDepartmentId = await this.resolveDepartmentForSubmit(
      userId,
      departmentId,
    );

    if (!resolvedDepartmentId) {
      return this.noDepartmentBudgetEvaluation(amount);
    }

    const budgetYear = resolveBudgetYear(submittedAt, this.getBudgetTimeZone());
    const summary = await this.getDepartmentSummary(
      resolvedDepartmentId,
      budgetYear,
    );

    return this.buildSubmitEvaluation(summary, amount);
  }

  async evaluateExpenseSubmitInTransaction(
    manager: EntityManager,
    userId: number,
    amount: number,
    submittedAt: Date = new Date(),
    departmentId?: number | null,
  ): Promise<BudgetSubmitEvaluation> {
    const resolvedDepartmentId = await this.resolveDepartmentForSubmit(
      userId,
      departmentId,
      manager,
    );

    if (!resolvedDepartmentId) {
      return this.noDepartmentBudgetEvaluation(amount);
    }

    const budgetYear = resolveBudgetYear(submittedAt, this.getBudgetTimeZone());

    await lockDepartmentBudgetRow(manager, resolvedDepartmentId, budgetYear);

    const summary = await this.getDepartmentSummaryInTransaction(
      manager,
      resolvedDepartmentId,
      budgetYear,
    );

    return this.buildSubmitEvaluation(summary, amount);
  }

  async evaluateExpenseApprove(
    departmentId: number | null | undefined,
    asOf: Date = new Date(),
  ): Promise<BudgetApproveEvaluation> {
    if (!departmentId) {
      return {
        summary: null,
        committedAmount: 0,
        wouldExceed: false,
      };
    }

    const budgetYear = resolveBudgetYear(asOf, this.getBudgetTimeZone());
    const summary = await this.getDepartmentSummary(departmentId, budgetYear);

    if (!summary.budget) {
      return {
        summary,
        committedAmount: summary.committedAmount,
        wouldExceed: false,
      };
    }

    return {
      summary,
      committedAmount: summary.committedAmount,
      wouldExceed: summary.committedAmount > summary.amountLimit,
    };
  }

  async recalculateCommittedAmountForDepartmentYear(
    departmentId: number,
    year: number,
    manager?: EntityManager,
  ): Promise<void> {
    this.assertValidYear(year);
    const { start, end } = budgetYearRangeInTimeZone(
      year,
      this.getBudgetTimeZone(),
    );
    const runner = manager ?? this.budgetRepository.manager;

    await recalculateDepartmentBudgetCommitted(
      runner,
      departmentId,
      year,
      start,
      end,
      BUDGET_COMMITTED_STATUSES,
    );
  }

  async recalculateReimbursedAmountForDepartmentYear(
    departmentId: number,
    year: number,
    manager?: EntityManager,
  ): Promise<void> {
    this.assertValidYear(year);
    const { start, end } = budgetYearRangeInTimeZone(
      year,
      this.getBudgetTimeZone(),
    );
    const runner = manager ?? this.budgetRepository.manager;

    await recalculateDepartmentBudgetReimbursed(
      runner,
      departmentId,
      year,
      start,
      end,
    );
  }

  private async syncReimbursedAmountForExpense(
    manager: EntityManager,
    snapshot: ExpenseBudgetSnapshot,
  ): Promise<void> {
    if (!snapshot.submittedAt) {
      return;
    }

    const departmentId = await this.resolveDepartmentForSubmit(
      snapshot.userId,
      snapshot.departmentId,
      manager,
    );
    if (!departmentId) {
      return;
    }

    const year = resolveBudgetYear(
      snapshot.submittedAt,
      this.getBudgetTimeZone(),
    );

    await applyReimbursedAmountDelta(
      manager,
      departmentId,
      year,
      snapshot.amount,
    );
  }

  async syncCommittedAmountForExpenseTransition(
    manager: EntityManager,
    before: ExpenseBudgetSnapshot | null,
    after: ExpenseBudgetSnapshot | null,
  ): Promise<void> {
    if (isReimbursementTransition(before, after)) {
      await this.syncReimbursedAmountForExpense(manager, after!);
      return;
    }

    if (!expenseBudgetAttributionChanged(before, after)) {
      return;
    }

    const timeZone = this.getBudgetTimeZone();
    const deltas = new Map<
      string,
      { departmentId: number; year: number; deltaAmount: number }
    >();

    const accumulate = async (
      snapshot: ExpenseBudgetSnapshot,
      sign: -1 | 1,
    ): Promise<void> => {
      if (
        !snapshot.submittedAt ||
        !countsTowardCommittedBudget(snapshot.status)
      ) {
        return;
      }

      const departmentId = await this.resolveDepartmentForSubmit(
        snapshot.userId,
        snapshot.departmentId,
        manager,
      );
      if (!departmentId) {
        return;
      }

      const year = resolveBudgetYear(snapshot.submittedAt, timeZone);
      const key = `${departmentId}:${year}`;
      const entry = deltas.get(key) ?? { departmentId, year, deltaAmount: 0 };
      entry.deltaAmount += sign * snapshot.amount;
      deltas.set(key, entry);
    };

    if (before) {
      await accumulate(before, -1);
    }
    if (after) {
      await accumulate(after, 1);
    }

    for (const { departmentId, year, deltaAmount } of deltas.values()) {
      if (deltaAmount === 0) {
        continue;
      }
      await applyCommittedAmountDelta(manager, departmentId, year, deltaAmount);
    }
  }

  async syncCommittedAmountForUserDepartmentChange(
    manager: EntityManager,
    userId: number,
    previousDepartmentId?: number | null,
    nextDepartmentId?: number | null,
  ): Promise<void> {
    if (previousDepartmentId === nextDepartmentId) {
      return;
    }

    const rows = await manager.query<Array<{ submitted_at: Date }>>(
      `
        SELECT DISTINCT e.submitted_at
        FROM expenses e
        WHERE e.user_id = $1
          AND e.department_id IS NULL
          AND e.submitted_at IS NOT NULL
          AND e.status::text = ANY($2::text[])
      `,
      [userId, BUDGET_COMMITTED_STATUSES],
    );

    if (rows.length === 0) {
      return;
    }

    const timeZone = this.getBudgetTimeZone();
    const years = new Set(
      rows.map((row) => resolveBudgetYear(row.submitted_at, timeZone)),
    );
    const departmentIds = [previousDepartmentId, nextDepartmentId].filter(
      (id): id is number => id != null,
    );

    for (const departmentId of departmentIds) {
      for (const year of years) {
        await this.recalculateCommittedAmountForDepartmentYear(
          departmentId,
          year,
          manager,
        );
      }
    }
  }

  async reconcileAllCommittedAmounts(manager?: EntityManager): Promise<void> {
    const runner = manager ?? this.budgetRepository.manager;
    const budgets = await runner.getRepository(DepartmentBudget).find({
      where: { isActive: true, deletedAt: IsNull() },
      select: { departmentId: true, year: true },
    });

    await runWithConcurrency(budgets, 10, async (budget) => {
      await this.recalculateCommittedAmountForDepartmentYear(
        budget.departmentId,
        budget.year,
        runner,
      );
      await this.recalculateReimbursedAmountForDepartmentYear(
        budget.departmentId,
        budget.year,
        runner,
      );
    });
  }

  emitOverspendIfNeeded(
    evaluation: BudgetSubmitEvaluation,
    context: {
      expenseId: number;
      userId: number;
      departmentId: number;
    },
  ): void {
    if (!evaluation.summary?.budget || !evaluation.wouldExceed) {
      return;
    }

    void this.domainEventPublisher.publish('budget.overspend', {
      expenseId: context.expenseId,
      userId: context.userId,
      departmentId: context.departmentId,
      year: evaluation.summary.year,
      amountLimit: evaluation.summary.amountLimit,
      projectedCommittedAmount: evaluation.projectedCommittedAmount,
    });
  }

  private getBudgetTimeZone(): string {
    return this.configService.get<string>('BUDGET_TIMEZONE', 'UTC');
  }

  private async resolveDepartmentForSubmit(
    userId: number,
    departmentId?: number | null,
    manager?: EntityManager,
  ): Promise<number | null> {
    if (departmentId) {
      return departmentId;
    }

    const userRepo = manager
      ? manager.getRepository(User)
      : this.userRepository;
    const user = await userRepo.findOne({
      where: { id: userId },
      select: { id: true, departmentId: true },
    });

    return user?.departmentId ?? null;
  }

  private noDepartmentBudgetEvaluation(amount: number): BudgetSubmitEvaluation {
    return {
      allowed: true,
      summary: null,
      projectedCommittedAmount: amount,
      wouldExceed: false,
    };
  }

  private buildSubmitEvaluation(
    summary: BudgetUsageSummary,
    amount: number,
  ): BudgetSubmitEvaluation {
    if (!summary.budget) {
      return {
        allowed: true,
        summary,
        projectedCommittedAmount: summary.committedAmount + amount,
        wouldExceed: false,
      };
    }

    const projectedCommittedAmount = summary.committedAmount + amount;
    const wouldExceed = projectedCommittedAmount > summary.amountLimit;
    const blockSubmit = this.configService.get<boolean>(
      'BUDGET_BLOCK_SUBMIT_ON_OVERSPEND',
      false,
    );
    const projectedMetrics = computeProjectedBudgetMetrics(
      summary.amountLimit,
      projectedCommittedAmount,
      this.getNearLimitThresholdPercent(),
    );

    return {
      allowed: !blockSubmit || !wouldExceed,
      summary: {
        ...summary,
        committedAmount: projectedCommittedAmount,
        ...projectedMetrics,
      },
      projectedCommittedAmount,
      wouldExceed,
    };
  }

  private async getDepartmentSummaryInTransaction(
    manager: EntityManager,
    departmentId: number,
    year: number,
  ): Promise<BudgetUsageSummary> {
    this.assertValidYear(year);
    const summary = await this.loadDepartmentBudgetSummary(
      departmentId,
      year,
      manager,
    );
    if (!summary) {
      throw new NotFoundException('Department not found');
    }
    return summary;
  }

  private async loadDepartmentBudgetSummary(
    departmentId: number,
    year: number,
    manager?: EntityManager,
  ): Promise<BudgetUsageSummary | null> {
    const { start, end } = budgetYearRangeInTimeZone(
      year,
      this.getBudgetTimeZone(),
    );

    return fetchDepartmentBudgetSummary(
      this.departmentRepository,
      {
        departmentId,
        year,
        periodStart: start,
        periodEnd: end,
        committedStatuses: BUDGET_COMMITTED_STATUSES,
        nearLimitThresholdPercent: this.getNearLimitThresholdPercent(),
      },
      manager,
    );
  }

  private getNearLimitThresholdPercent(): number {
    return this.configService.get<number>('BUDGET_ALERT_THRESHOLD_PERCENT', 80);
  }

  private resolveBudgetSortColumn(sortBy?: ListBudgetsQuery['sortBy']): string {
    switch (sortBy) {
      case 'departmentName':
        return 'department.name';
      case 'year':
        return 'budget.year';
      case 'amountLimit':
        return 'budget.amountLimit';
      case 'committedAmount':
        return 'budget.committedAmount';
      case 'reimbursedAmount':
        return 'budget.reimbursedAmount';
      case 'remainingAmount':
        return 'budget.remainingAmount';
      case 'utilizationPercent':
      default:
        return 'budget.utilizationPercent';
    }
  }

  private assertValidYear(year: number): void {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Invalid budget year');
    }
  }

  private assertCreatableBudgetYear(year: number): void {
    const currentYear = resolveBudgetYear(new Date(), this.getBudgetTimeZone());
    if (year < currentYear) {
      throw new BadRequestException('Budget year cannot be in the past');
    }
  }

  private assertPositiveLimit(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        'Budget limit must be a positive whole number in minor units',
      );
    }
  }
}
