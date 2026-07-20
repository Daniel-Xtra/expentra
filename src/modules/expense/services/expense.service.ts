import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { ExpensePolicyRuleType } from 'src/database/entities/expense-policy.enums';
import {
  ExpenseCategory,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import { ApprovalLevelCatalogService } from 'src/modules/approval/services/approval-level-catalog.service';
import { ApprovalRoutingService } from 'src/modules/approval/services/approval-routing.service';
import type { ExpenseSubmitCheckResult } from '../types/expense-submit-check.types';
import type { IAuthUser } from 'src/definition';
import type { IExpenseService } from '../contracts/expense.contract';
import type {
  BulkReimburseResult,
  CreateExpenseInput,
  ExpenseDuplicateCheckResult,
  ExpensePolicyHint,
  ExpenseStatusCounts,
  FinanceQueueSummary,
  ListExpensesQuery,
  PaginatedExpensesResult,
  PendingApprovalSummary,
  UpdateExpenseInput,
} from '../types/expense.types';
import { ExpenseDraftService } from './expense-draft.service';
import { ExpenseQueryService } from './expense-query.service';
import { ExpenseReimbursementService } from './expense-reimbursement.service';
import { ExpenseSubmitService } from './expense-submit.service';

const ACTIVE_POLICY_SPEND_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
  ExpenseStatus.APPROVED,
  ExpenseStatus.REIMBURSED,
];

@Injectable()
export class ExpenseService implements IExpenseService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpensePolicy)
    private readonly policyRepository: Repository<ExpensePolicy>,
    private readonly approvalRouting: ApprovalRoutingService,
    private readonly approvalLevelCatalog: ApprovalLevelCatalogService,
    private readonly expenseQueryService: ExpenseQueryService,
    private readonly expenseDraftService: ExpenseDraftService,
    private readonly expenseSubmitService: ExpenseSubmitService,
    private readonly expenseReimbursementService: ExpenseReimbursementService,
  ) {}

  create(userId: number, input: CreateExpenseInput): Promise<Expense> {
    return this.expenseDraftService.create(userId, input);
  }

  findPersonalExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult> {
    return this.expenseQueryService.findPersonalExpenses(authUser, query);
  }

  findAllExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult> {
    return this.expenseQueryService.findAllExpenses(authUser, query);
  }

  getPersonalExpenseStatusCounts(
    authUser: IAuthUser,
  ): Promise<ExpenseStatusCounts> {
    return this.expenseQueryService.getPersonalExpenseStatusCounts(authUser);
  }

  getAllExpenseStatusCounts(authUser: IAuthUser): Promise<ExpenseStatusCounts> {
    return this.expenseQueryService.getAllExpenseStatusCounts(authUser);
  }

  buildPersonalExpensesExportCsv(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<string> {
    return this.expenseQueryService.buildPersonalExpensesExportCsv(
      authUser,
      query,
    );
  }

  buildAllExpensesExportCsv(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<string> {
    return this.expenseQueryService.buildAllExpensesExportCsv(authUser, query);
  }

  async getPolicyHints(
    authUser: IAuthUser,
    category?: ExpenseCategory,
  ): Promise<ExpensePolicyHint[]> {
    const policies = await this.policyRepository.find({
      where: { isActive: true },
    });
    if (policies.length === 0) {
      return [];
    }

    const caps = this.extractCategoryCaps(policies).filter((cap) =>
      category ? cap.category === category : true,
    );
    if (caps.length === 0) {
      return [];
    }

    const { start, end } = this.monthRange(new Date());
    const spendByCategory = await this.loadMonthlySpendByCategory(
      authUser.id,
      start,
      end,
    );

    return caps.map((cap) => {
      const currentSpend = spendByCategory.get(cap.category) ?? 0;
      const remainingAmount = Math.max(cap.capAmount - currentSpend, 0);
      const utilizationPercent =
        cap.capAmount > 0
          ? Math.round((currentSpend / cap.capAmount) * 1000) / 10
          : 0;

      return {
        category: cap.category,
        policyName: cap.policyName,
        capAmount: cap.capAmount,
        currentSpend,
        remainingAmount,
        utilizationPercent,
      };
    });
  }

  async checkDuplicateExpense(
    authUser: IAuthUser,
    input: {
      amount: number;
      category: ExpenseCategory;
      excludeReference?: string;
      windowDays?: number;
    },
  ): Promise<ExpenseDuplicateCheckResult> {
    const windowDays = input.windowDays ?? 30;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - windowDays);

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.user_id = :userId', { userId: authUser.id })
      .andWhere('expense.amount = :amount', { amount: input.amount })
      .andWhere('expense.category = :category', { category: input.category })
      .andWhere('expense.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [ExpenseStatus.DRAFT, ExpenseStatus.REJECTED],
      })
      .andWhere('expense.submitted_at >= :since', { since });

    if (input.excludeReference) {
      qb.andWhere('expense.reference != :excludeReference', {
        excludeReference: input.excludeReference,
      });
    }

    const duplicate = await qb.getOne();
    if (!duplicate) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      message: `A similar ${input.category.toLowerCase()} claim for the same amount was submitted in the last ${windowDays} days.`,
    };
  }

  findForApprovalExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult> {
    return this.expenseQueryService.findForApprovalExpenses(authUser, query);
  }

  resolveApprovalBudgetFlags(expenses: Expense[]) {
    return this.expenseQueryService.resolveApprovalBudgetFlags(expenses);
  }

  resolveApprovalBudgetFlagsForExpense(expense: Expense) {
    return this.expenseQueryService.resolveApprovalBudgetFlagsForExpense(
      expense,
    );
  }

  getPendingApprovalSummary(
    authUser: IAuthUser,
  ): Promise<PendingApprovalSummary> {
    return this.expenseQueryService.getPendingApprovalSummary(authUser);
  }

  getFinanceQueueSummary(authUser: IAuthUser): Promise<FinanceQueueSummary> {
    return this.expenseQueryService.getFinanceQueueSummary(authUser);
  }

  buildPayrollExportCsv(authUser: IAuthUser): Promise<string> {
    return this.expenseQueryService.buildPayrollExportCsv(authUser);
  }

  reopenRejected(authUser: IAuthUser, reference: string): Promise<Expense> {
    return this.expenseDraftService.reopenRejected(authUser, reference);
  }

  bulkReimburse(
    authUser: IAuthUser,
    references: string[],
  ): Promise<BulkReimburseResult> {
    return this.expenseReimbursementService.bulkReimburse(authUser, references);
  }

  findOne(authUser: IAuthUser, reference: string): Promise<Expense> {
    return this.expenseQueryService.findOne(authUser, reference);
  }

  canActOnApproval(authUser: IAuthUser, expense: Expense): Promise<boolean> {
    return this.expenseQueryService.canActOnApproval(authUser, expense);
  }

  async buildApprovalChain(expense: Expense) {
    const approvalLevels = await this.approvalLevelCatalog.getActiveLevels();
    return this.approvalRouting.buildApprovalChain(
      expense,
      approvalLevels,
      expense.approvals ?? [],
    );
  }

  update(
    authUser: IAuthUser,
    reference: string,
    input: UpdateExpenseInput,
  ): Promise<Expense> {
    return this.expenseDraftService.update(authUser, reference, input);
  }

  remove(authUser: IAuthUser, reference: string): Promise<void> {
    return this.expenseDraftService.remove(authUser, reference);
  }

  checkSubmitPolicies(
    authUser: IAuthUser,
    reference: string,
  ): Promise<ExpenseSubmitCheckResult> {
    return this.expenseSubmitService.checkSubmitPolicies(authUser, reference);
  }

  submit(
    authUser: IAuthUser,
    reference: string,
    options?: { policyJustifications?: Record<string, string> },
  ): Promise<Expense> {
    return this.expenseSubmitService.submit(authUser, reference, options);
  }

  reimburse(authUser: IAuthUser, reference: string): Promise<Expense> {
    return this.expenseReimbursementService.reimburse(authUser, reference);
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
      if (policy.ruleType !== ExpensePolicyRuleType.CATEGORY_MONTHLY_CAP) {
        continue;
      }

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
        statuses: ACTIVE_POLICY_SPEND_STATUSES,
      })
      .andWhere('expense.submitted_at >= :start', { start })
      .andWhere('expense.submitted_at < :end', { end })
      .groupBy('expense.category')
      .getRawMany<{ category: ExpenseCategory; total: string }>();

    return new Map(
      rows.map((row) => [row.category, parseInt(row.total ?? '0', 10)]),
    );
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
}
