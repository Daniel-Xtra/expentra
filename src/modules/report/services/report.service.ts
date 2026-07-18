import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, SelectQueryBuilder, Repository } from 'typeorm';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { AuditLog } from 'src/database/entities/audit-log.entity';
import {
  AuditAction,
  AuditResourceType,
} from 'src/database/entities/audit-log.enums';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { ExpenseStatus, ExpenseCategory } from 'src/database/entities/expense.enums';
import { User } from 'src/database/entities/user.entity';
import type { IAuthUser } from 'src/definition';
import { AccessPolicyService } from 'src/modules/authorization';
import { BUDGET_COMMITTED_STATUSES } from 'src/modules/budget/constants/budget.constants';
import {
  budgetYearRange,
  budgetYearRangeInTimeZone,
} from 'src/modules/budget/utils/budget-period.util';
import { fetchOrganizationBudgetSummary } from '../queries/organization-budget-summary.query';
import type { IReportService } from '../contracts/report.contract';
import type {
  CategorySpendingRow,
  DepartmentSpendingRow,
  ExpenseExportRow,
  OrganizationBudgetSummary,
  PendingPayoutSummary,
  PolicyViolationSummary,
  ReimbursementSlaSummary,
  SpendComparisonSummary,
  SpendingReportQuery,
  SpendingSummaryReport,
  TopSpenderRow,
  YearlyMonthlySpendingReport,
  YearlySpendingQuery,
} from '../types/report.types';

const ORGANIZATION_BUDGET_NEAR_LIMIT_PERCENT = 80;
const TOP_SPENDERS_LIMIT = 10;
import { resolveReportStatuses } from '../constants/report-statuses.constants';
import { ReportPeriodMode } from '../constants/report-period-mode.enum';
import { buildCsv } from '../utils/csv-export.util';
import { toExportIsoDate } from '../utils/date-export.util';
import {
  ageInDays,
  bucketAgeDays,
  emptyAgingBuckets,
  percentChange,
  previousReportPeriod,
  resolveReportPeriodMode,
  resolveReportPeriodRange,
  yearAgoReportPeriod,
} from '../utils/report-insight.util';
import { buildSpendingReportPdf } from '../utils/spending-report-pdf.builder';
import { formatReportPeriodLabel } from '../utils/report-period-label.util';

@Injectable()
export class ReportService implements IReportService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(DepartmentBudget)
    private readonly budgetRepository: Repository<DepartmentBudget>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(ExpensePolicy)
    private readonly policyRepository: Repository<ExpensePolicy>,
    private readonly accessPolicy: AccessPolicyService,
    private readonly configService: ConfigService,
  ) {}

  async getSpendingSummary(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<SpendingSummaryReport> {
    const statuses = this.reportStatuses(query);
    const departmentId = await this.resolveDepartmentFilter(authUser, query);
    const qb = this.scopedExpenseQuery(authUser, query, statuses, departmentId);

    const totals = await qb
      .clone()
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne<{ count: string; total: string }>();

    const byStatusRows = await qb
      .clone()
      .select('expense.status', 'status')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('expense.status')
      .orderBy('expense.status', 'ASC')
      .getRawMany<{ status: ExpenseStatus; count: string; total: string }>();

    const totalAmount = parseInt(totals?.total ?? '0', 10);
    const expenseCount = parseInt(totals?.count ?? '0', 10);

    const [
      organizationBudget,
      pendingPayout,
      reimbursementSla,
      comparison,
      policyViolations,
      topSpenders,
    ] = await Promise.all([
      this.getOrganizationBudget(query.year),
      this.getPendingPayoutSummary(),
      this.getReimbursementSla(authUser, query, departmentId),
      this.getSpendComparison(authUser, query, departmentId, {
        totalAmount,
        expenseCount,
      }),
      this.getPolicyViolationSummary(authUser, query, departmentId),
      this.getTopSpenders(authUser, query, statuses, departmentId),
    ]);

    const periodMode = resolveReportPeriodMode(query);

    return {
      year: query.year,
      periodMode,
      ...(periodMode === ReportPeriodMode.MONTH && query.month != null
        ? { month: query.month }
        : {}),
      ...(periodMode === ReportPeriodMode.QUARTER && query.quarter != null
        ? { quarter: query.quarter }
        : {}),
      currency: 'NGN',
      totalAmount,
      expenseCount,
      byStatus: byStatusRows.map((row) => ({
        status: row.status,
        count: parseInt(row.count, 10),
        totalAmount: parseInt(row.total, 10),
      })),
      organizationBudget,
      pendingPayout,
      reimbursementSla,
      comparison,
      policyViolations,
      topSpenders,
    };
  }

  private async getPendingPayoutSummary(): Promise<PendingPayoutSummary> {
    const rows = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('expense.amount', 'amount')
      .addSelect('expense.approved_at', 'approvedAt')
      .where('expense.status = :status', { status: ExpenseStatus.APPROVED })
      .andWhere('expense.approved_at IS NOT NULL')
      .getRawMany<{ amount: string; approvedAt: Date }>();

    const now = new Date();
    const agingBuckets = emptyAgingBuckets();
    const bucketByKey = new Map(agingBuckets.map((bucket) => [bucket.key, bucket]));

    let totalAmount = 0;
    let oldestApprovedAt: Date | null = null;

    for (const row of rows) {
      const amount = parseInt(row.amount ?? '0', 10);
      totalAmount += amount;
      const approvedAt = new Date(row.approvedAt);
      if (!oldestApprovedAt || approvedAt < oldestApprovedAt) {
        oldestApprovedAt = approvedAt;
      }
      const key = bucketAgeDays(ageInDays(approvedAt, now));
      const bucket = bucketByKey.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.totalAmount += amount;
      }
    }

    return {
      currency: 'NGN',
      count: rows.length,
      totalAmount,
      oldestApprovedAt,
      agingBuckets,
    };
  }

  private async getReimbursementSla(
    authUser: IAuthUser,
    query: SpendingReportQuery,
    departmentId?: number,
  ): Promise<ReimbursementSlaSummary> {
    const { start, end } = resolveReportPeriodRange(query);
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .innerJoin('expense.user', 'expenseOwner')
      .where('expense.status = :status', { status: ExpenseStatus.REIMBURSED })
      .andWhere('expense.approved_at IS NOT NULL')
      .andWhere('expense.reimbursed_at IS NOT NULL')
      .andWhere('expense.reimbursed_at >= :start', { start })
      .andWhere('expense.reimbursed_at < :end', { end });

    this.applyVisibilityScope(qb, authUser);
    this.applyOptionalFilters(qb, query, departmentId);

    const row = await qb
      .select(
        'AVG(EXTRACT(EPOCH FROM (expense.reimbursed_at - expense.approved_at)) / 86400)',
        'avgDays',
      )
      .addSelect('COUNT(expense.id)', 'count')
      .getRawOne<{ avgDays: string | null; count: string }>();

    const reimbursedCount = parseInt(row?.count ?? '0', 10);
    if (row?.avgDays == null || reimbursedCount === 0) {
      return { avgDays: null, reimbursedCount };
    }

    const avgDays = Number(row.avgDays);
    return {
      avgDays: Number.isFinite(avgDays) ? Math.round(avgDays * 10) / 10 : null,
      reimbursedCount,
    };
  }

  private async getSpendComparison(
    authUser: IAuthUser,
    query: SpendingReportQuery,
    departmentId: number | undefined,
    current: { totalAmount: number; expenseCount: number },
  ): Promise<SpendComparisonSummary> {
    const statuses = this.reportStatuses(query);
    const previousPeriod = previousReportPeriod(query);
    const previousYear = yearAgoReportPeriod(query);

    const [periodTotals, yoyTotals] = await Promise.all([
      this.getPeriodTotals(
        authUser,
        { ...query, ...previousPeriod },
        statuses,
        departmentId,
      ),
      this.getPeriodTotals(
        authUser,
        { ...query, ...previousYear },
        statuses,
        departmentId,
      ),
    ]);

    return {
      monthOverMonth: {
        year: previousPeriod.year,
        ...(previousPeriod.month != null ? { month: previousPeriod.month } : {}),
        ...(previousPeriod.quarter != null
          ? { quarter: previousPeriod.quarter }
          : {}),
        totalAmount: periodTotals.totalAmount,
        expenseCount: periodTotals.expenseCount,
        amountChangePercent: percentChange(
          current.totalAmount,
          periodTotals.totalAmount,
        ),
        countChangePercent: percentChange(
          current.expenseCount,
          periodTotals.expenseCount,
        ),
      },
      yearOverYear: {
        year: previousYear.year,
        ...(previousYear.month != null ? { month: previousYear.month } : {}),
        ...(previousYear.quarter != null
          ? { quarter: previousYear.quarter }
          : {}),
        totalAmount: yoyTotals.totalAmount,
        expenseCount: yoyTotals.expenseCount,
        amountChangePercent: percentChange(
          current.totalAmount,
          yoyTotals.totalAmount,
        ),
        countChangePercent: percentChange(
          current.expenseCount,
          yoyTotals.expenseCount,
        ),
      },
    };
  }

  private async getPeriodTotals(
    authUser: IAuthUser,
    query: SpendingReportQuery,
    statuses: ExpenseStatus[],
    departmentId?: number,
  ): Promise<{ totalAmount: number; expenseCount: number }> {
    const totals = await this.scopedExpenseQuery(authUser, query, statuses, departmentId)
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne<{ count: string; total: string }>();

    return {
      totalAmount: parseInt(totals?.total ?? '0', 10),
      expenseCount: parseInt(totals?.count ?? '0', 10),
    };
  }

  private async getPolicyViolationSummary(
    authUser: IAuthUser,
    query: SpendingReportQuery,
    departmentId?: number,
  ): Promise<PolicyViolationSummary> {
    const { start, end } = resolveReportPeriodRange(query);

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .innerJoin(
        Expense,
        'expense',
        'expense.reference = audit.resource_reference',
      )
      .innerJoin(User, 'expenseOwner', 'expenseOwner.id = expense.user_id')
      .where('audit.action = :action', { action: AuditAction.POLICY_VIOLATION })
      .andWhere('audit.resource_type = :resourceType', {
        resourceType: AuditResourceType.EXPENSE,
      })
      .andWhere('audit.created_at >= :start', { start })
      .andWhere('audit.created_at < :end', { end });

    this.applyExpenseOwnerVisibility(qb, authUser);
    if (departmentId != null) {
      qb.andWhere('expenseOwner.department_id = :departmentId', {
        departmentId,
      });
    }
    if (query.category) {
      qb.andWhere('expense.category = :category', { category: query.category });
    }

    const rows = await qb
      .select('audit.metadata', 'metadata')
      .addSelect('expense.reference', 'expenseReference')
      .getRawMany<{
        metadata: Record<string, unknown> | string | null;
        expenseReference: string;
      }>();

    const expenseRefs = new Set<string>();
    const countByPolicy = new Map<string, number>();

    for (const row of rows) {
      expenseRefs.add(row.expenseReference);
      let metadata: Record<string, unknown> = {};
      if (typeof row.metadata === 'string') {
        try {
          metadata = JSON.parse(row.metadata) as Record<string, unknown>;
        } catch {
          metadata = {};
        }
      } else if (row.metadata && typeof row.metadata === 'object') {
        metadata = row.metadata;
      }
      const policyReference =
        typeof metadata.policyReference === 'string'
          ? metadata.policyReference
          : 'unknown';
      countByPolicy.set(
        policyReference,
        (countByPolicy.get(policyReference) ?? 0) + 1,
      );
    }

    const policyReferences = [...countByPolicy.keys()].filter(
      (ref) => ref !== 'unknown',
    );
    const policies = policyReferences.length
      ? await this.policyRepository.find({
          where: { reference: In(policyReferences) },
          select: { reference: true, name: true },
        })
      : [];
    const nameByRef = new Map(
      policies.map((policy) => [policy.reference, policy.name]),
    );

    const byPolicy = [...countByPolicy.entries()]
      .map(([policyReference, count]) => ({
        policyReference,
        policyName:
          policyReference === 'unknown'
            ? null
            : (nameByRef.get(policyReference) ?? null),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      exceptionCount: rows.length,
      expenseCount: expenseRefs.size,
      byPolicy,
    };
  }

  private async getTopSpenders(
    authUser: IAuthUser,
    query: SpendingReportQuery,
    statuses: ExpenseStatus[],
    departmentId?: number,
  ): Promise<TopSpenderRow[]> {
    const rows = await this.scopedExpenseQuery(authUser, query, statuses, departmentId)
      .leftJoin('expenseOwner.department', 'department')
      .select('expenseOwner.reference', 'userReference')
      .addSelect('expenseOwner.email', 'userEmail')
      .addSelect('expenseOwner.firstName', 'firstName')
      .addSelect('expenseOwner.lastName', 'lastName')
      .addSelect('department.name', 'departmentName')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('expenseOwner.reference')
      .addGroupBy('expenseOwner.email')
      .addGroupBy('expenseOwner.firstName')
      .addGroupBy('expenseOwner.lastName')
      .addGroupBy('department.name')
      .orderBy('total', 'DESC')
      .limit(TOP_SPENDERS_LIMIT)
      .getRawMany<{
        userReference: string;
        userEmail: string;
        firstName: string | null;
        lastName: string | null;
        departmentName: string | null;
        count: string;
        total: string;
      }>();

    return rows.map((row) => ({
      userReference: row.userReference,
      userEmail: row.userEmail,
      firstName: row.firstName,
      lastName: row.lastName,
      departmentName: row.departmentName,
      count: parseInt(row.count, 10),
      totalAmount: parseInt(row.total, 10),
    }));
  }

  private applyOptionalFilters(
    qb: SelectQueryBuilder<Expense>,
    query: Pick<SpendingReportQuery, 'category'>,
    departmentId?: number,
  ): void {
    if (departmentId != null) {
      qb.andWhere('expenseOwner.department_id = :departmentId', {
        departmentId,
      });
    }
    if (query.category) {
      qb.andWhere('expense.category = :category', { category: query.category });
    }
  }

  private async getOrganizationBudget(
    year: number,
  ): Promise<OrganizationBudgetSummary> {
    const timeZone = this.configService.get<string>('BUDGET_TIMEZONE', 'UTC');
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
    const isNearLimit =
      amountLimit > 0 &&
      !isOverBudget &&
      utilizationPercent >= ORGANIZATION_BUDGET_NEAR_LIMIT_PERCENT;

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
      hasBudget: departmentCount > 0 && amountLimit > 0,
    };
  }

  async getSpendingByCategory(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<CategorySpendingRow[]> {
    const statuses = this.reportStatuses(query);
    const departmentId = await this.resolveDepartmentFilter(authUser, query);
    const rows = await this.scopedExpenseQuery(
      authUser,
      query,
      statuses,
      departmentId,
    )
      .select('expense.category', 'category')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('expense.category')
      .orderBy('total', 'DESC')
      .getRawMany<{ category: string; count: string; total: string }>();

    return rows.map((row) => ({
      category: row.category,
      count: parseInt(row.count, 10),
      totalAmount: parseInt(row.total, 10),
    }));
  }

  async getSpendingByMonth(
    authUser: IAuthUser,
    query: YearlySpendingQuery,
  ): Promise<YearlyMonthlySpendingReport> {
    const statuses = this.reportStatuses(query);
    const departmentId = await this.resolveDepartmentFilter(authUser, query);
    const qb = this.scopedYearExpenseQuery(
      authUser,
      query,
      statuses,
      departmentId,
    )
      .select('EXTRACT(MONTH FROM expense.submitted_at)', 'month')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('EXTRACT(MONTH FROM expense.submitted_at)')
      .orderBy('month', 'ASC');

    this.appendCategoryAmountSelects(qb);

    const rows = await qb.getRawMany<
      { month: string; count: string; total: string } & Record<
        string,
        string | undefined
      >
    >();

    const byMonth = new Map(
      rows.map((row) => [
        parseInt(row.month, 10),
        {
          totalAmount: parseInt(row.total, 10),
          expenseCount: parseInt(row.count, 10),
          categoryAmounts: this.parseCategoryAmountsFromRaw(row),
        },
      ]),
    );

    return {
      year: query.year,
      currency: 'NGN',
      months: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const row = byMonth.get(month);
        return {
          month,
          totalAmount: row?.totalAmount ?? 0,
          expenseCount: row?.expenseCount ?? 0,
          categoryAmounts: row?.categoryAmounts ?? {},
        };
      }),
    };
  }

  private appendCategoryAmountSelects(
    qb: SelectQueryBuilder<Expense>,
  ): SelectQueryBuilder<Expense> {
    for (const category of Object.values(ExpenseCategory)) {
      qb.addSelect(
        `COALESCE(SUM(CASE WHEN expense.category = '${category}' THEN expense.amount ELSE 0 END), 0)`,
        `cat_${category}`,
      );
    }
    return qb;
  }

  private parseCategoryAmountsFromRaw(
    row?: Record<string, string | undefined>,
  ): Partial<Record<ExpenseCategory, number>> {
    const amounts: Partial<Record<ExpenseCategory, number>> = {};
    const normalized = Object.fromEntries(
      Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );

    for (const category of Object.values(ExpenseCategory)) {
      const value = parseInt(
        normalized[`cat_${category.toLowerCase()}`] ?? '0',
        10,
      );
      if (value > 0) {
        amounts[category] = value;
      }
    }
    return amounts;
  }

  async getSpendingByDepartment(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<DepartmentSpendingRow[]> {
    const statuses = this.reportStatuses(query);
    const departmentId = await this.resolveDepartmentFilter(authUser, query, {
      restrictToUserDepartment: true,
    });
    const rows = await this.scopedExpenseQuery(
      authUser,
      query,
      statuses,
      departmentId,
    )
      .leftJoin('expenseOwner.department', 'department')
      .select('department.reference', 'departmentReference')
      .addSelect('department.name', 'departmentName')
      .addSelect('department.code', 'departmentCode')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('department.reference')
      .addGroupBy('department.name')
      .addGroupBy('department.code')
      .orderBy('total', 'DESC')
      .getRawMany<{
        departmentReference: string | null;
        departmentName: string | null;
        departmentCode: string | null;
        count: string;
        total: string;
      }>();

    return rows
      .filter((row) => row.departmentReference)
      .map((row) => ({
        departmentReference: row.departmentReference as string,
        departmentName: row.departmentName ?? 'Unknown',
        departmentCode: row.departmentCode ?? '',
        count: parseInt(row.count, 10),
        totalAmount: parseInt(row.total, 10),
      }));
  }

  async getExpenseExportRows(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<ExpenseExportRow[]> {
    const statuses = this.reportStatuses(query);
    const departmentId = await this.resolveDepartmentFilter(authUser, query);
    const expenses = await this.scopedExpenseQuery(
      authUser,
      query,
      statuses,
      departmentId,
    )
      .leftJoinAndSelect('expense.user', 'user')
      .leftJoinAndSelect('user.department', 'department')
      .orderBy('expense.submittedAt', 'DESC')
      .getMany();

    return expenses.map((expense) => {
      const user = expense.user;
      return {
        expenseReference: expense.reference,
        title: expense.title,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        status: expense.status,
        userReference: user?.reference ?? '',
        userEmail: user?.email ?? '',
        departmentReference: user?.department?.reference ?? null,
        departmentName: user?.department?.name ?? null,
        submittedAt: toExportIsoDate(expense.submittedAt),
        approvedAt: toExportIsoDate(expense.approvedAt),
        reimbursedAt: toExportIsoDate(expense.reimbursedAt),
      };
    });
  }

  async buildSpendingReportPdf(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<Buffer> {
    const [summary, categories, departments, expenses] = await Promise.all([
      this.getSpendingSummary(authUser, query),
      this.getSpendingByCategory(authUser, query),
      this.getSpendingByDepartment(authUser, query),
      this.getExpenseExportRows(authUser, query),
    ]);

    return buildSpendingReportPdf({
      periodLabel: formatReportPeriodLabel(query),
      summary,
      categories,
      departments,
      expenses,
    });
  }

  buildExpensesCsv(rows: ExpenseExportRow[]): string {
    return buildCsv(
      [
        'expense_reference',
        'title',
        'amount',
        'currency',
        'category',
        'status',
        'user_reference',
        'user_email',
        'department_reference',
        'department_name',
        'submitted_at',
        'approved_at',
        'reimbursed_at',
      ],
      rows.map((row): string[] => [
        row.expenseReference,
        row.title,
        String(row.amount),
        row.currency,
        row.category,
        row.status,
        row.userReference,
        row.userEmail,
        row.departmentReference ?? '',
        row.departmentName ?? '',
        row.submittedAt ?? '',
        row.approvedAt ?? '',
        row.reimbursedAt ?? '',
      ]),
    );
  }

  private async resolveDepartmentFilter(
    authUser: IAuthUser,
    query: SpendingReportQuery | YearlySpendingQuery,
    options?: { restrictToUserDepartment?: boolean },
  ): Promise<number | undefined> {
    if (query.departmentReference) {
      const department = await findEntityByReference(
        this.departmentRepository,
        query.departmentReference,
        'Department not found',
      );
      return department.id;
    }

    if (
      options?.restrictToUserDepartment &&
      this.accessPolicy.expenseListVisibility(authUser) !== 'all'
    ) {
      const user = await this.userRepository.findOne({
        where: { id: authUser.id },
        select: { id: true, departmentId: true },
      });
      return user?.departmentId ?? undefined;
    }

    return undefined;
  }

  private scopedYearExpenseQuery(
    authUser: IAuthUser,
    query: YearlySpendingQuery,
    statuses: ExpenseStatus[],
    departmentId?: number,
  ): SelectQueryBuilder<Expense> {
    const { start, end } = budgetYearRange(query.year);

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .innerJoin('expense.user', 'expenseOwner')
      .where('expense.status IN (:...statuses)', { statuses })
      .andWhere('expense.submitted_at IS NOT NULL')
      .andWhere('expense.submitted_at >= :start', { start })
      .andWhere('expense.submitted_at < :end', { end });

    this.applyVisibilityScope(qb, authUser);

    if (departmentId != null) {
      qb.andWhere('expenseOwner.department_id = :departmentId', {
        departmentId,
      });
    }

    if (query.category) {
      qb.andWhere('expense.category = :category', { category: query.category });
    }

    return qb;
  }

  private scopedExpenseQuery(
    authUser: IAuthUser,
    query: SpendingReportQuery,
    statuses: ExpenseStatus[],
    departmentId?: number,
  ): SelectQueryBuilder<Expense> {
    const { start, end } = resolveReportPeriodRange(query);

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .innerJoin('expense.user', 'expenseOwner')
      .where('expense.status IN (:...statuses)', { statuses })
      .andWhere('expense.submitted_at IS NOT NULL')
      .andWhere('expense.submitted_at >= :start', { start })
      .andWhere('expense.submitted_at < :end', { end });

    this.applyVisibilityScope(qb, authUser);

    if (departmentId != null) {
      qb.andWhere('expenseOwner.department_id = :departmentId', {
        departmentId,
      });
    }

    if (query.category) {
      qb.andWhere('expense.category = :category', { category: query.category });
    }

    return qb;
  }

  private applyExpenseOwnerVisibility(
    qb: SelectQueryBuilder<Expense> | SelectQueryBuilder<AuditLog>,
    authUser: IAuthUser,
  ): void {
    const visibility = this.accessPolicy.expenseListVisibility(authUser);

    if (visibility === 'all') {
      return;
    }

    if (visibility === 'own-and-submitted') {
      qb.andWhere(
        '(expense.user_id = :reportUserId OR expense.status IN (:...pendingStatuses))',
        {
          reportUserId: authUser.id,
          pendingStatuses: [
            ExpenseStatus.SUBMITTED,
            ExpenseStatus.UNDER_REVIEW,
          ],
        },
      );
      return;
    }

    qb.andWhere('expense.user_id = :reportUserId', {
      reportUserId: authUser.id,
    });
  }

  private applyVisibilityScope(
    qb: SelectQueryBuilder<Expense>,
    authUser: IAuthUser,
  ): void {
    this.applyExpenseOwnerVisibility(qb, authUser);
  }

  private reportStatuses(
    query: Pick<SpendingReportQuery | YearlySpendingQuery, 'mode' | 'includePipeline'>,
  ): ExpenseStatus[] {
    return resolveReportStatuses({
      mode: query.mode,
      includePipeline: query.includePipeline,
    });
  }
}
