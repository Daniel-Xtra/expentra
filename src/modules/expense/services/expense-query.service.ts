import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { ExpenseAttachment } from 'src/database/entities/expense-attachment.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { AccessPolicyService } from 'src/modules/authorization';
import { ActionableApprovalQueueService } from 'src/modules/approval/services/actionable-approval-queue.service';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from 'src/modules/budget/contracts/budget.contract';
import { toExportIsoDate } from 'src/modules/report/utils/date-export.util';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import type { IAuthUser } from 'src/definition';
import { EXPENSE_POLICY_RELATIONS } from '../constants/expense-access.relations';
import {
  ExpenseListSortField,
  ExpenseListSortOrder,
} from '../dtos/list-expenses.query.dto';
import type {
  ExpenseStatusCounts,
  FinanceQueueSummary,
  ListExpensesQuery,
  PaginatedExpensesResult,
  PayrollExportRow,
  PendingApprovalSummary,
} from '../types/expense.types';
import { buildExpenseListExportCsv } from '../utils/expense-list-export.util';
import {
  buildPayrollExportCsv,
  formatAmountMajor,
} from '../utils/payroll-export.util';

const PENDING_APPROVAL_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
];

const NEEDS_ACTION_STATUSES = [ExpenseStatus.DRAFT, ExpenseStatus.REJECTED];

const FINANCE_AGING_BUCKET_DEFS = [
  { key: '0_7' as const, label: '0–7 days' },
  { key: '8_14' as const, label: '8–14 days' },
  { key: '15_30' as const, label: '15–30 days' },
  { key: '30_plus' as const, label: '30+ days' },
];

function emptyFinanceAgingBuckets() {
  return FINANCE_AGING_BUCKET_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    count: 0,
    totalAmount: 0,
  }));
}

const EXPORT_ROW_LIMIT = 5000;

const APPROVAL_AGING_DAYS = 3;

export type ApprovalQueueBudgetFlags = {
  budgetWouldExceed: boolean;
  requiresOverBudgetAcknowledgment: boolean;
};

@Injectable()
export class ExpenseQueryService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseAttachment)
    private readonly attachmentRepository: Repository<ExpenseAttachment>,
    private readonly accessPolicy: AccessPolicyService,
    private readonly actionableQueue: ActionableApprovalQueueService,
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
  ) {}

  async findPersonalExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult> {
    this.accessPolicy.assertCanListPersonalExpenses(authUser);

    const pagination = this.resolvePagination(query);
    const qb = this.createExpenseListQueryBuilder().andWhere(
      'expense.userId = :userId',
      { userId: authUser.id },
    );

    this.applyListFilters(qb, query);
    this.applyListSort(qb, query);
    return this.executePaginatedQuery(qb, pagination);
  }

  async findAllExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult> {
    this.accessPolicy.assertCanListAllExpenses(authUser);

    const pagination = this.resolvePagination(query);
    const qb = this.createExpenseListQueryBuilder();
    this.excludeOthersDrafts(qb, authUser.id);

    this.applyListFilters(qb, query);
    this.applyListSort(qb, query);
    const result = await this.executePaginatedQuery(qb, pagination);
    await this.attachPrimaryReceipts(result.data);
    return result;
  }

  async getPersonalExpenseStatusCounts(
    authUser: IAuthUser,
  ): Promise<ExpenseStatusCounts> {
    this.accessPolicy.assertCanListPersonalExpenses(authUser);
    return this.getExpenseStatusCounts({ userId: authUser.id });
  }

  async getAllExpenseStatusCounts(
    authUser: IAuthUser,
  ): Promise<ExpenseStatusCounts> {
    this.accessPolicy.assertCanListAllExpenses(authUser);
    return this.getExpenseStatusCounts({ viewerUserId: authUser.id });
  }

  async buildPersonalExpensesExportCsv(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<string> {
    this.accessPolicy.assertCanListPersonalExpenses(authUser);
    const qb = this.createExpenseListQueryBuilder().andWhere(
      'expense.userId = :userId',
      { userId: authUser.id },
    );
    this.applyListFilters(qb, query);
    this.applyListSort(qb, query);
    const expenses = await qb.take(EXPORT_ROW_LIMIT).getMany();
    return buildExpenseListExportCsv(expenses);
  }

  async buildAllExpensesExportCsv(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<string> {
    this.accessPolicy.assertCanListAllExpenses(authUser);
    const qb = this.createExpenseListQueryBuilder();
    this.excludeOthersDrafts(qb, authUser.id);
    this.applyListFilters(qb, query);
    this.applyListSort(qb, query);
    const expenses = await qb.take(EXPORT_ROW_LIMIT).getMany();
    return buildExpenseListExportCsv(expenses);
  }

  async findForApprovalExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult> {
    this.accessPolicy.assertCanListForApprovalExpenses(authUser);

    const pagination = this.resolvePagination(query);
    const qb = this.createExpenseListQueryBuilder();
    const deptManagerOnly =
      this.accessPolicy.isManagerApprover(authUser) &&
      !this.accessPolicy.hasGlobalApprovalPermission(authUser);

    if (deptManagerOnly) {
      const deptIds = authUser.managedDepartmentIds;
      if (deptIds.length === 0) {
        return {
          data: [],
          meta: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      qb.leftJoin('expense.user', 'expenseOwner');
      qb.andWhere(
        `(expense.userId = :userId OR (
          expense.status IN (:...pendingStatuses) AND (
            expense.departmentId IN (:...deptIds)
            OR expenseOwner.departmentId IN (:...deptIds)
          )
        ))`,
        {
          pendingStatuses: PENDING_APPROVAL_STATUSES,
          userId: authUser.id,
          deptIds,
        },
      );
    } else {
      qb.andWhere(
        '(expense.status IN (:...pendingStatuses) OR expense.userId = :userId)',
        {
          pendingStatuses: PENDING_APPROVAL_STATUSES,
          userId: authUser.id,
        },
      );
    }

    this.applyListFilters(qb, query);

    const actionableOnly = query.actionableOnly !== false;
    if (actionableOnly) {
      await this.applyActionableApprovalFilter(qb, authUser);
    }

    if (query.agingOnly) {
      const agingCutoff = new Date();
      agingCutoff.setUTCDate(agingCutoff.getUTCDate() - APPROVAL_AGING_DAYS);
      qb.andWhere('expense.submittedAt IS NOT NULL');
      qb.andWhere('expense.submittedAt < :approvalAgingCutoff', {
        approvalAgingCutoff: agingCutoff,
      });
    }

    this.applyListSort(qb, query);

    const result = await this.executePaginatedQuery(qb, pagination);
    await this.attachPrimaryReceipts(result.data);
    return result;
  }

  private async attachPrimaryReceipts(expenses: Expense[]): Promise<void> {
    if (expenses.length === 0) {
      return;
    }

    const expenseIds = expenses.map((expense) => expense.id);
    const attachments = await this.attachmentRepository.find({
      where: { expenseId: In(expenseIds) },
      order: { createdAt: 'ASC' },
    });

    const byExpenseId = new Map<number, ExpenseAttachment[]>();
    for (const attachment of attachments) {
      const bucket = byExpenseId.get(attachment.expenseId) ?? [];
      bucket.push(attachment);
      byExpenseId.set(attachment.expenseId, bucket);
    }

    for (const expense of expenses) {
      expense.attachments = byExpenseId.get(expense.id) ?? [];
    }
  }

  async getPendingApprovalSummary(
    authUser: IAuthUser,
  ): Promise<PendingApprovalSummary> {
    this.accessPolicy.assertCanListForApprovalExpenses(authUser);

    const actionableIds =
      await this.actionableQueue.getActionableExpenseIds(authUser);
    if (actionableIds.length === 0) {
      return {
        currency: 'NGN',
        awaitingApprovalCount: 0,
        awaitingApprovalAmount: 0,
        agingApprovalCount: 0,
      };
    }

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.id IN (:...actionableIds)', { actionableIds });

    const totals = await qb
      .clone()
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne<{ count: string; total: string }>();

    const agingCutoff = new Date();
    agingCutoff.setUTCDate(agingCutoff.getUTCDate() - APPROVAL_AGING_DAYS);

    const agingCount = await qb
      .clone()
      .andWhere('expense.submittedAt IS NOT NULL')
      .andWhere('expense.submittedAt < :agingCutoff', { agingCutoff })
      .getCount();

    return {
      currency: 'NGN',
      awaitingApprovalCount: parseInt(totals?.count ?? '0', 10),
      awaitingApprovalAmount: parseInt(totals?.total ?? '0', 10),
      agingApprovalCount: agingCount,
    };
  }

  async getFinanceQueueSummary(
    authUser: IAuthUser,
  ): Promise<FinanceQueueSummary> {
    this.accessPolicy.assertCanReimburseExpense(authUser);

    const [approvedRows, recentlyReimbursed] = await Promise.all([
      this.expenseRepository
        .createQueryBuilder('expense')
        .select('expense.amount', 'amount')
        .addSelect('expense.approved_at', 'approvedAt')
        .where('expense.status = :status', { status: ExpenseStatus.APPROVED })
        .andWhere('expense.approved_at IS NOT NULL')
        .getRawMany<{ amount: string; approvedAt: Date }>(),
      this.getRecentlyReimbursedSummary(),
    ]);

    const now = new Date();
    const agingBuckets = emptyFinanceAgingBuckets();
    const bucketByKey = new Map(
      agingBuckets.map((bucket) => [bucket.key, bucket]),
    );

    let totalAmount = 0;
    let oldestApprovedAt: Date | null = null;

    for (const row of approvedRows) {
      const amount = parseInt(row.amount ?? '0', 10);
      totalAmount += amount;
      const approvedAt = new Date(row.approvedAt);
      if (!oldestApprovedAt || approvedAt < oldestApprovedAt) {
        oldestApprovedAt = approvedAt;
      }
      const ageMs = now.getTime() - approvedAt.getTime();
      const ageDays = Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
      const key =
        ageDays < 8
          ? '0_7'
          : ageDays < 15
            ? '8_14'
            : ageDays < 31
              ? '15_30'
              : '30_plus';
      const bucket = bucketByKey.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.totalAmount += amount;
      }
    }

    return {
      currency: 'NGN',
      approvedCount: approvedRows.length,
      approvedAmount: totalAmount,
      oldestApprovedAt,
      agingBuckets,
      recentlyReimbursed,
    };
  }

  private async getRecentlyReimbursedSummary(): Promise<{
    currency: string;
    count: number;
    totalAmount: number;
    windowDays: number;
  }> {
    const windowDays = 7;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - windowDays);

    const totals = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COUNT(expense.id)', 'count')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.status = :status', { status: ExpenseStatus.REIMBURSED })
      .andWhere('expense.reimbursed_at IS NOT NULL')
      .andWhere('expense.reimbursed_at >= :since', { since })
      .getRawOne<{ count: string; total: string }>();

    return {
      currency: 'NGN',
      count: parseInt(totals?.count ?? '0', 10),
      totalAmount: parseInt(totals?.total ?? '0', 10),
      windowDays,
    };
  }

  async buildPayrollExportCsv(authUser: IAuthUser): Promise<string> {
    this.accessPolicy.assertCanReimburseExpense(authUser);

    const expenses = await this.expenseRepository.find({
      where: { status: ExpenseStatus.APPROVED },
      relations: { user: true, department: true },
      order: { approvedAt: 'ASC' },
      take: EXPORT_ROW_LIMIT,
    });

    const rows: PayrollExportRow[] = expenses.map((expense) => {
      const employeeName =
        [expense.user?.firstName, expense.user?.lastName]
          .filter(Boolean)
          .join(' ') ||
        expense.user?.email ||
        '';

      return {
        employeeEmail: expense.user?.email ?? '',
        employeeName,
        expenseReference: expense.reference,
        title: expense.title,
        amountMajor: formatAmountMajor(expense.amount),
        currency: expense.currency,
        departmentName: expense.department?.name ?? '',
        approvedAt: toExportIsoDate(expense.approvedAt) ?? '',
        narration: expense.title,
      };
    });

    return buildPayrollExportCsv(rows);
  }

  async findOne(authUser: IAuthUser, reference: string): Promise<Expense> {
    const expense = await this.loadExpenseWithRelations(reference);
    this.accessPolicy.assertCanReadExpense(authUser, expense);
    return expense;
  }

  async canActOnApproval(
    authUser: IAuthUser,
    expense: Expense,
  ): Promise<boolean> {
    if (
      expense.status !== ExpenseStatus.SUBMITTED &&
      expense.status !== ExpenseStatus.UNDER_REVIEW
    ) {
      return false;
    }

    const actionableIds =
      await this.actionableQueue.getActionableExpenseIds(authUser);
    return actionableIds.includes(expense.id);
  }

  async loadExpenseWithRelations(reference: string): Promise<Expense> {
    const resolved = await findEntityByReference(
      this.expenseRepository,
      reference,
      'Expense not found',
    );
    const expense = await this.expenseRepository.findOne({
      where: { id: resolved.id },
      relations: EXPENSE_POLICY_RELATIONS,
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  private async applyActionableApprovalFilter(
    qb: SelectQueryBuilder<Expense>,
    authUser: IAuthUser,
  ): Promise<void> {
    const actionableIds =
      await this.actionableQueue.getActionableExpenseIds(authUser);
    qb.andWhere('expense.id IN (:...actionableIds)', {
      actionableIds: actionableIds.length > 0 ? actionableIds : [-1],
    });
  }

  private resolvePagination(query: ListExpensesQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit, skip: (page - 1) * limit };
  }

  private createExpenseListQueryBuilder(): SelectQueryBuilder<Expense> {
    return this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.user', 'user')
      .leftJoinAndSelect('expense.department', 'department');
  }

  /** Company-wide lists must never expose another user's drafts. */
  private excludeOthersDrafts(
    qb: SelectQueryBuilder<Expense>,
    viewerUserId: number,
  ): void {
    qb.andWhere(
      '(expense.status != :draftStatus OR expense.userId = :draftOwnerId)',
      {
        draftStatus: ExpenseStatus.DRAFT,
        draftOwnerId: viewerUserId,
      },
    );
  }

  async resolveApprovalBudgetFlags(
    expenses: Expense[],
  ): Promise<Map<number, ApprovalQueueBudgetFlags>> {
    const flags = new Map<number, ApprovalQueueBudgetFlags>();
    if (expenses.length === 0) {
      return flags;
    }

    const cache = new Map<string, boolean>();

    for (const expense of expenses) {
      const departmentId = expense.departmentId ?? null;
      const asOf = expense.submittedAt ?? expense.createdAt ?? new Date();
      const year = asOf.getUTCFullYear();
      const cacheKey = `${departmentId ?? 'none'}:${year}`;

      let wouldExceed = cache.get(cacheKey);
      if (wouldExceed === undefined) {
        const evaluation = await this.budgetService.evaluateExpenseApprove(
          departmentId,
          asOf,
        );
        wouldExceed = evaluation.wouldExceed;
        cache.set(cacheKey, wouldExceed);
      }

      flags.set(expense.id, {
        budgetWouldExceed: wouldExceed,
        requiresOverBudgetAcknowledgment:
          wouldExceed && expense.status === ExpenseStatus.UNDER_REVIEW,
      });
    }

    return flags;
  }

  async resolveApprovalBudgetFlagsForExpense(
    expense: Expense,
  ): Promise<ApprovalQueueBudgetFlags> {
    const map = await this.resolveApprovalBudgetFlags([expense]);
    return (
      map.get(expense.id) ?? {
        budgetWouldExceed: false,
        requiresOverBudgetAcknowledgment: false,
      }
    );
  }

  private applyListFilters(
    qb: SelectQueryBuilder<Expense>,
    query: ListExpensesQuery,
  ): void {
    if (query.needsAction) {
      qb.andWhere('expense.status IN (:...needsActionStatuses)', {
        needsActionStatuses: NEEDS_ACTION_STATUSES,
      });
      return;
    }

    if (query.status) {
      qb.andWhere('expense.status = :status', { status: query.status });
    }
  }

  private applyListSort(
    qb: SelectQueryBuilder<Expense>,
    query: ListExpensesQuery,
  ): void {
    const sortBy = query.sortBy ?? ExpenseListSortField.UPDATED_AT;
    const sortOrder = query.sortOrder ?? ExpenseListSortOrder.DESC;
    const columnMap: Record<ExpenseListSortField, string> = {
      [ExpenseListSortField.CREATED_AT]: 'expense.createdAt',
      [ExpenseListSortField.UPDATED_AT]: 'expense.updatedAt',
      [ExpenseListSortField.AMOUNT]: 'expense.amount',
      [ExpenseListSortField.STATUS]: 'expense.status',
      [ExpenseListSortField.SUBMITTED_AT]: 'expense.submittedAt',
      [ExpenseListSortField.APPROVED_AT]: 'expense.approvedAt',
    };

    qb.orderBy(columnMap[sortBy], sortOrder, 'NULLS LAST');
    if (sortBy !== ExpenseListSortField.UPDATED_AT) {
      qb.addOrderBy('expense.updatedAt', 'DESC');
    }
  }

  private async getExpenseStatusCounts(options?: {
    userId?: number;
    /** When set (company-wide counts), hide other users' drafts. */
    viewerUserId?: number;
  }): Promise<ExpenseStatusCounts> {
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .select('expense.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (options?.userId) {
      qb.where('expense.userId = :userId', { userId: options.userId });
    } else if (options?.viewerUserId != null) {
      this.excludeOthersDrafts(qb, options.viewerUserId);
    }

    const rows = await qb.groupBy('expense.status').getRawMany<{
      status: ExpenseStatus;
      count: string;
    }>();

    const byStatus = rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));

    const needsAction = byStatus
      .filter((row) => NEEDS_ACTION_STATUSES.includes(row.status))
      .reduce((total, row) => total + row.count, 0);

    return { byStatus, needsAction };
  }

  private async executePaginatedQuery(
    qb: SelectQueryBuilder<Expense>,
    pagination: { page: number; limit: number; skip: number },
  ): Promise<PaginatedExpensesResult> {
    const { page, limit, skip } = pagination;
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
}
