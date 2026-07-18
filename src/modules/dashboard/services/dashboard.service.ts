import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { ExpensePolicyRuleType } from 'src/database/entities/expense-policy.enums';
import {
  ExpenseCategory,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type { IAuthUser } from 'src/definition';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from 'src/modules/budget/contracts/budget.contract';
import { resolveBudgetYear } from 'src/modules/budget/utils/budget-period.util';
import type { PolicyCondition } from 'src/modules/policy/types/policy.types';
import { buildCsv } from 'src/modules/report/utils/csv-export.util';
import type { IDashboardService } from '../contracts/dashboard.contract';
import type {
  DashboardPeriodQuery,
  DashboardPeriodTrend,
  DashboardPolicyWarning,
  DashboardReimbursementStats,
  DashboardSpendPeriodRow,
  PersonalDashboard,
  TeamDashboard,
} from '../types/dashboard.types';

const AGING_DAYS = 3;
const POLICY_WARNING_THRESHOLD = 0.8;
const RECENT_EXPENSE_LIMIT = 8;

const IN_APPROVAL_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
];

const MONTHLY_SPEND_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
  ExpenseStatus.APPROVED,
  ExpenseStatus.REIMBURSED,
];

type ResolvedPeriod = {
  year: number;
  month?: number;
  quarter?: number;
  start: Date;
  end: Date;
  label: string;
};

@Injectable()
export class DashboardService implements IDashboardService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpensePolicy)
    private readonly policyRepository: Repository<ExpensePolicy>,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly configService: ConfigService,
  ) {}

  async getPersonalDashboard(
    authUser: IAuthUser,
    query: DashboardPeriodQuery,
  ): Promise<PersonalDashboard> {
    const period = this.resolvePeriod(query);
    const previousPeriod = this.resolvePreviousPeriod(query, period);

    const baseQb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.user_id = :userId', { userId: authUser.id })
      .andWhere('expense.created_at >= :start', { start: period.start })
      .andWhere('expense.created_at < :end', { end: period.end });

    const totals = await baseQb
      .clone()
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne<{ count: string; total: string }>();

    const pending = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.user_id = :userId', { userId: authUser.id })
      .andWhere('expense.status = :status', { status: ExpenseStatus.APPROVED })
      .getRawOne<{ count: string; total: string }>();

    const inApproval = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.user_id = :userId', { userId: authUser.id })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: IN_APPROVAL_STATUSES,
      })
      .getRawOne<{ count: string; total: string }>();

    const [
      drafts,
      rejected,
      recentExpenses,
      reimbursementStats,
      trend,
      policyWarnings,
      spendOverTime,
    ] = await Promise.all([
      this.getActionBucket(authUser.id, ExpenseStatus.DRAFT),
      this.getActionBucket(authUser.id, ExpenseStatus.REJECTED),
      this.getRecentExpenses(authUser.id),
      this.getReimbursementStats(authUser.id, period.start, period.end),
      this.getPeriodTrend(authUser.id, period, previousPeriod),
      this.getPolicyWarnings(authUser.id),
      this.getPersonalSpendOverTime(authUser.id, period, query),
    ]);

    const spendTimeMeta = this.resolveSpendOverTimeMeta(query);

    return {
      year: period.year,
      month: period.month,
      quarter: period.quarter,
      periodLabel: period.label,
      currency: 'NGN',
      totalAmount: parseInt(totals?.total ?? '0', 10),
      expenseCount: parseInt(totals?.count ?? '0', 10),
      pendingReimbursementAmount: parseInt(pending?.total ?? '0', 10),
      pendingReimbursementCount: parseInt(pending?.count ?? '0', 10),
      inApprovalAmount: parseInt(inApproval?.total ?? '0', 10),
      inApprovalCount: parseInt(inApproval?.count ?? '0', 10),
      actionRequired: { drafts, rejected },
      reimbursementStats,
      avgDaysToReimbursement: reimbursementStats.avgDays,
      spendOverTime,
      spendOverTimeGranularity: spendTimeMeta.granularity,
      recentExpenses,
      policyWarnings,
      trend,
    };
  }

  async exportPersonalDashboardCsv(
    authUser: IAuthUser,
    query: DashboardPeriodQuery,
  ): Promise<string> {
    const dashboard = await this.getPersonalDashboard(authUser, query);
    const period = this.resolvePeriod(query);

    const expenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.user_id = :userId', { userId: authUser.id })
      .andWhere('expense.created_at >= :start', { start: period.start })
      .andWhere('expense.created_at < :end', { end: period.end })
      .orderBy('expense.created_at', 'DESC')
      .getMany();

    const summaryRows: Array<Array<string | number | null>> = [
      ['Period', dashboard.periodLabel],
      ['Total spend', dashboard.totalAmount],
      ['Expense count', dashboard.expenseCount],
      ['Pending reimbursement', dashboard.pendingReimbursementAmount],
      ['In approval', dashboard.inApprovalAmount],
      ['Drafts needing action', dashboard.actionRequired.drafts.count],
      ['Rejected needing action', dashboard.actionRequired.rejected.count],
      [
        'Average days to reimbursement',
        dashboard.reimbursementStats.avgDays ?? 'N/A',
      ],
      [
        'Reimbursed claims in period',
        dashboard.reimbursementStats.reimbursedCount,
      ],
      ['Trend vs previous period', dashboard.trend.label],
      ['Previous period spend', dashboard.trend.previousTotalAmount],
      ['Spend change %', dashboard.trend.totalAmountChangePercent ?? 'N/A'],
    ];

    const expenseRows = expenses.map((expense) => [
      expense.reference,
      expense.title,
      expense.category,
      expense.status,
      expense.amount,
      expense.createdAt.toISOString(),
      expense.submittedAt?.toISOString() ?? '',
      expense.approvedAt?.toISOString() ?? '',
      expense.reimbursedAt?.toISOString() ?? '',
    ]);

    return (
      buildCsv(['Metric', 'Value'], summaryRows) +
      '\n' +
      buildCsv(
        [
          'Reference',
          'Title',
          'Category',
          'Status',
          'Amount (kobo)',
          'Created at',
          'Submitted at',
          'Approved at',
          'Reimbursed at',
        ],
        expenseRows,
      )
    );
  }

  async getTeamDashboardForDepartment(
    department: { id: number; reference: string; name: string },
    query: DashboardPeriodQuery,
  ): Promise<TeamDashboard> {
    const departmentId = department.id;
    const { year, month, quarter, start, end } = this.resolvePeriod(query);

    const teamTotals = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.user', 'owner')
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where(
        '(expense.department_id = :departmentId OR owner.department_id = :departmentId)',
        { departmentId },
      )
      .andWhere('expense.status IN (:...spendStatuses)', {
        spendStatuses: MONTHLY_SPEND_STATUSES,
      })
      .andWhere('expense.created_at >= :start', { start })
      .andWhere('expense.created_at < :end', { end })
      .getRawOne<{ count: string; total: string }>();

    const agingCutoff = new Date();
    agingCutoff.setUTCDate(agingCutoff.getUTCDate() - AGING_DAYS);

    const pendingApprovals = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.user', 'owner')
      .where('expense.status IN (:...statuses)', {
        statuses: IN_APPROVAL_STATUSES,
      })
      .andWhere(
        '(expense.department_id = :departmentId OR owner.department_id = :departmentId)',
        { departmentId },
      )
      .getCount();

    const agingApprovals = await this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.user', 'owner')
      .where('expense.status IN (:...statuses)', {
        statuses: IN_APPROVAL_STATUSES,
      })
      .andWhere('expense.submitted_at IS NOT NULL')
      .andWhere('expense.submitted_at < :agingCutoff', { agingCutoff })
      .andWhere(
        '(expense.department_id = :departmentId OR owner.department_id = :departmentId)',
        { departmentId },
      )
      .getCount();

    const budgetSummary = await this.budgetService.getDepartmentSummary(
      departmentId,
      year,
    );

    const committed = budgetSummary.budget?.committedAmount ?? null;
    const limit = budgetSummary.amountLimit ?? null;
    const projectedUtilizationPercent =
      limit && committed != null
        ? Math.round((committed / limit) * 10000) / 100
        : null;

    const spendOverTime = await this.getTeamSpendOverTime(
      departmentId,
      start,
      end,
      query,
    );
    const spendTimeMeta = this.resolveSpendOverTimeMeta(query);
    const remainingAmount =
      limit != null && committed != null
        ? Math.max(0, limit - committed)
        : null;

    return {
      year,
      month,
      quarter,
      currency: 'NGN',
      departmentReference: department.reference,
      departmentName: department.name,
      teamSpendAmount: parseInt(teamTotals?.total ?? '0', 10),
      teamExpenseCount: parseInt(teamTotals?.count ?? '0', 10),
      budgetLimit: limit,
      committedAmount: committed,
      remainingAmount,
      utilizationPercent: budgetSummary.budget?.utilizationPercent ?? null,
      projectedUtilizationPercent,
      pendingApprovals,
      agingApprovals,
      spendOverTime,
      spendOverTimeGranularity: spendTimeMeta.granularity,
    };
  }

  private async getActionBucket(userId: number, status: ExpenseStatus) {
    const row = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.user_id = :userId', { userId })
      .andWhere('expense.status = :status', { status })
      .getRawOne<{ count: string; total: string }>();

    return {
      count: parseInt(row?.count ?? '0', 10),
      totalAmount: parseInt(row?.total ?? '0', 10),
    };
  }

  private async getRecentExpenses(userId: number) {
    const expenses = await this.expenseRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: RECENT_EXPENSE_LIMIT,
    });

    return expenses.map((expense) => ({
      reference: expense.reference,
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      status: expense.status,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    }));
  }

  private async getReimbursementStats(
    userId: number,
    start: Date,
    end: Date,
  ): Promise<DashboardReimbursementStats> {
    const row = await this.expenseRepository
      .createQueryBuilder('expense')
      .select(
        'AVG(EXTRACT(EPOCH FROM (expense.reimbursed_at - expense.approved_at)) / 86400)',
        'avgDays',
      )
      .addSelect('COUNT(expense.id)', 'count')
      .where('expense.user_id = :userId', { userId })
      .andWhere('expense.status = :status', {
        status: ExpenseStatus.REIMBURSED,
      })
      .andWhere('expense.approved_at IS NOT NULL')
      .andWhere('expense.reimbursed_at IS NOT NULL')
      .andWhere('expense.created_at >= :start', { start })
      .andWhere('expense.created_at < :end', { end })
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

  private resolveSpendOverTimeMeta(query: DashboardPeriodQuery): {
    granularity: 'month' | 'week';
  } {
    return { granularity: query.month ? 'week' : 'month' };
  }

  private async getPersonalSpendOverTime(
    userId: number,
    period: ResolvedPeriod,
    query: DashboardPeriodQuery,
  ): Promise<DashboardSpendPeriodRow[]> {
    const scope = (
      qb: ReturnType<typeof this.expenseRepository.createQueryBuilder>,
    ) => qb.where('expense.user_id = :userId', { userId });

    if (query.month) {
      return this.getWeeklySpendOverTime(scope, period.start, period.end, {
        includeCategories: true,
      });
    }

    const months = this.resolveMonthsInPeriod(query);
    return this.getMonthlySpendOverTime(
      scope,
      period.start,
      period.end,
      months,
      {
        includeCategories: true,
      },
    );
  }

  private async getTeamSpendOverTime(
    departmentId: number,
    start: Date,
    end: Date,
    query: DashboardPeriodQuery,
  ): Promise<DashboardSpendPeriodRow[]> {
    const scope = (
      qb: ReturnType<typeof this.expenseRepository.createQueryBuilder>,
    ) =>
      qb
        .leftJoin('expense.user', 'owner')
        .where(
          '(expense.department_id = :departmentId OR owner.department_id = :departmentId)',
          { departmentId },
        )
        .andWhere('expense.status IN (:...spendStatuses)', {
          spendStatuses: MONTHLY_SPEND_STATUSES,
        });

    if (query.month) {
      return this.getWeeklySpendOverTime(scope, start, end, {
        includeCategories: true,
      });
    }

    const months = this.resolveMonthsInPeriod(query);
    return this.getMonthlySpendOverTime(scope, start, end, months, {
      includeCategories: true,
    });
  }

  private resolveMonthsInPeriod(query: DashboardPeriodQuery): number[] {
    if (query.quarter) {
      const startMonth = (query.quarter - 1) * 3 + 1;
      return [startMonth, startMonth + 1, startMonth + 2];
    }
    return Array.from({ length: 12 }, (_, index) => index + 1);
  }

  private appendCategoryAmountSelects(
    qb: ReturnType<typeof this.expenseRepository.createQueryBuilder>,
  ) {
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

  private async getMonthlySpendOverTime(
    applyScope: (
      qb: ReturnType<typeof this.expenseRepository.createQueryBuilder>,
    ) => ReturnType<typeof this.expenseRepository.createQueryBuilder>,
    start: Date,
    end: Date,
    months: number[],
    options?: { includeCategories?: boolean },
  ): Promise<DashboardSpendPeriodRow[]> {
    const qb = applyScope(this.expenseRepository.createQueryBuilder('expense'))
      .select('EXTRACT(MONTH FROM expense.created_at)', 'month')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .andWhere('expense.created_at >= :start', { start })
      .andWhere('expense.created_at < :end', { end })
      .groupBy('EXTRACT(MONTH FROM expense.created_at)')
      .orderBy('month', 'ASC');

    if (options?.includeCategories) {
      this.appendCategoryAmountSelects(qb);
    }

    const rows = await qb.getRawMany<{
      month: string;
      count: string;
      total: string;
    } & Record<string, string | undefined>>();
    const byMonth = new Map(
      rows.map((row) => [
        parseInt(row.month, 10),
        {
          totalAmount: parseInt(row.total, 10),
          expenseCount: parseInt(row.count, 10),
          categoryAmounts: options?.includeCategories
            ? this.parseCategoryAmountsFromRaw(row)
            : undefined,
        },
      ]),
    );

    return months.map((month) => {
      const row = byMonth.get(month);
      return {
        period: month,
        label: this.monthName(month).slice(0, 3),
        totalAmount: row?.totalAmount ?? 0,
        expenseCount: row?.expenseCount ?? 0,
        categoryAmounts: options?.includeCategories
          ? (row?.categoryAmounts ?? {})
          : undefined,
      };
    });
  }

  private async getWeeklySpendOverTime(
    applyScope: (
      qb: ReturnType<typeof this.expenseRepository.createQueryBuilder>,
    ) => ReturnType<typeof this.expenseRepository.createQueryBuilder>,
    start: Date,
    end: Date,
    options?: { includeCategories?: boolean },
  ): Promise<DashboardSpendPeriodRow[]> {
    const qb = applyScope(this.expenseRepository.createQueryBuilder('expense'))
      .select('CEIL(EXTRACT(DAY FROM expense.created_at) / 7.0)', 'week')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .andWhere('expense.created_at >= :start', { start })
      .andWhere('expense.created_at < :end', { end })
      .groupBy('CEIL(EXTRACT(DAY FROM expense.created_at) / 7.0)')
      .orderBy('week', 'ASC');

    if (options?.includeCategories) {
      this.appendCategoryAmountSelects(qb);
    }

    const rows = await qb.getRawMany<{
      week: string;
      count: string;
      total: string;
    } & Record<string, string | undefined>>();
    const byWeek = new Map(
      rows.map((row) => [
        parseInt(row.week, 10),
        {
          totalAmount: parseInt(row.total, 10),
          expenseCount: parseInt(row.count, 10),
          categoryAmounts: options?.includeCategories
            ? this.parseCategoryAmountsFromRaw(row)
            : undefined,
        },
      ]),
    );

    return [1, 2, 3, 4, 5].map((week) => {
      const row = byWeek.get(week);
      return {
        period: week,
        label: `Wk ${week}`,
        totalAmount: row?.totalAmount ?? 0,
        expenseCount: row?.expenseCount ?? 0,
        categoryAmounts: options?.includeCategories
          ? (row?.categoryAmounts ?? {})
          : undefined,
      };
    });
  }

  private async getPeriodTrend(
    userId: number,
    current: ResolvedPeriod,
    previous: ResolvedPeriod,
  ): Promise<DashboardPeriodTrend> {
    const [currentTotals, previousTotals] = await Promise.all([
      this.getPeriodTotals(userId, current.start, current.end),
      this.getPeriodTotals(userId, previous.start, previous.end),
    ]);

    return {
      previousTotalAmount: previousTotals.totalAmount,
      previousExpenseCount: previousTotals.expenseCount,
      totalAmountChangePercent: this.percentChange(
        currentTotals.totalAmount,
        previousTotals.totalAmount,
      ),
      expenseCountChangePercent: this.percentChange(
        currentTotals.expenseCount,
        previousTotals.expenseCount,
      ),
      label: previous.label,
    };
  }

  private async getPeriodTotals(userId: number, start: Date, end: Date) {
    const row = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.user_id = :userId', { userId })
      .andWhere('expense.created_at >= :start', { start })
      .andWhere('expense.created_at < :end', { end })
      .getRawOne<{ count: string; total: string }>();

    return {
      expenseCount: parseInt(row?.count ?? '0', 10),
      totalAmount: parseInt(row?.total ?? '0', 10),
    };
  }

  private percentChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private async getPolicyWarnings(
    userId: number,
  ): Promise<DashboardPolicyWarning[]> {
    const policies = await this.policyRepository.find({
      where: { isActive: true },
    });
    if (policies.length === 0) {
      return [];
    }

    const caps = this.extractCategoryCaps(policies);
    if (caps.length === 0) {
      return [];
    }

    const now = new Date();
    const { start, end } = this.monthRange(now);
    const spendByCategory = await this.loadMonthlySpendByCategory(
      userId,
      start,
      end,
    );
    const warnings: DashboardPolicyWarning[] = [];

    for (const cap of caps) {
      const currentSpend = spendByCategory.get(cap.category) ?? 0;
      if (cap.capAmount <= 0) {
        continue;
      }

      const utilizationPercent =
        Math.round((currentSpend / cap.capAmount) * 1000) / 10;
      if (currentSpend < cap.capAmount * POLICY_WARNING_THRESHOLD) {
        continue;
      }

      warnings.push({
        policyReference: cap.policyReference,
        policyName: cap.policyName,
        category: cap.category,
        capAmount: cap.capAmount,
        currentSpend,
        utilizationPercent,
        message:
          currentSpend >= cap.capAmount
            ? `${this.formatCategoryLabel(cap.category)} monthly spend has reached the policy cap.`
            : `${this.formatCategoryLabel(cap.category)} monthly spend is at ${utilizationPercent}% of the policy cap.`,
      });
    }

    return warnings.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  }

  private extractCategoryCaps(policies: ExpensePolicy[]): Array<{
    policyReference: string;
    policyName: string;
    category: ExpenseCategory;
    capAmount: number;
  }> {
    const caps: Array<{
      policyReference: string;
      policyName: string;
      category: ExpenseCategory;
      capAmount: number;
    }> = [];

    for (const policy of policies) {
      if (policy.ruleType === ExpensePolicyRuleType.CATEGORY_MONTHLY_CAP) {
        const config = policy.config as {
          category?: ExpenseCategory;
          capKobo?: number;
        };
        if (config.category && config.capKobo) {
          caps.push({
            policyReference: policy.reference,
            policyName: policy.name,
            category: config.category,
            capAmount: config.capKobo,
          });
        }
        continue;
      }

      const conditions = Array.isArray(policy.config?.conditions)
        ? (policy.config.conditions as PolicyCondition[])
        : [];

      for (const condition of conditions) {
        if (
          condition.field !== 'monthly_category_spend' ||
          !condition.params?.category
        ) {
          continue;
        }
        if (condition.operator !== 'gt' && condition.operator !== 'gte') {
          continue;
        }

        caps.push({
          policyReference: policy.reference,
          policyName: policy.name,
          category: condition.params.category,
          capAmount: Number(condition.value),
        });
      }
    }

    return caps;
  }

  private async loadMonthlySpendByCategory(
    userId: number,
    start: Date,
    end: Date,
  ): Promise<Map<ExpenseCategory, number>> {
    const rows = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.user_id = :userId', { userId })
      .andWhere('expense.status IN (:...statuses)', {
        statuses: MONTHLY_SPEND_STATUSES,
      })
      .andWhere('expense.submitted_at >= :start', { start })
      .andWhere('expense.submitted_at < :end', { end })
      .groupBy('expense.category')
      .getRawMany<{ category: ExpenseCategory; total: string }>();

    return new Map(
      rows.map((row) => [row.category, parseInt(row.total ?? '0', 10)]),
    );
  }

  private resolvePeriod(query: DashboardPeriodQuery): ResolvedPeriod {
    const timeZone = this.configService.get<string>('BUDGET_TIMEZONE', 'UTC');
    const now = new Date();
    const year = query.year ?? resolveBudgetYear(now, timeZone);

    if (query.month) {
      const start = new Date(Date.UTC(year, query.month - 1, 1));
      const end = new Date(Date.UTC(year, query.month, 1));
      return {
        year,
        month: query.month,
        start,
        end,
        label: `${this.monthName(query.month)} ${year}`,
      };
    }

    if (query.quarter) {
      const startMonth = (query.quarter - 1) * 3;
      const start = new Date(Date.UTC(year, startMonth, 1));
      const end = new Date(Date.UTC(year, startMonth + 3, 1));
      return {
        year,
        quarter: query.quarter,
        start,
        end,
        label: `Q${query.quarter} ${year}`,
      };
    }

    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return {
      year,
      start,
      end,
      label: `${year}`,
    };
  }

  private resolvePreviousPeriod(
    query: DashboardPeriodQuery,
    current: ResolvedPeriod,
  ): ResolvedPeriod {
    if (query.month) {
      let month = query.month - 1;
      let year = current.year;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
      return this.resolvePeriod({ year, month });
    }

    if (query.quarter) {
      let quarter = query.quarter - 1;
      let year = current.year;
      if (quarter < 1) {
        quarter = 4;
        year -= 1;
      }
      return this.resolvePeriod({ year, quarter });
    }

    return this.resolvePeriod({ year: current.year - 1 });
  }

  private monthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
    );
    return { start, end };
  }

  private monthName(month: number): string {
    return new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });
  }

  private formatCategoryLabel(category: ExpenseCategory): string {
    return category.charAt(0) + category.slice(1).toLowerCase();
  }
}
