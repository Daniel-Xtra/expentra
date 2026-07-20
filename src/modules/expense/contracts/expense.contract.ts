import type { IAuthUser } from 'src/definition';
import type { Expense } from 'src/database/entities/expense.entity';
import type { ApprovalChainStep } from 'src/modules/approval/services/approval-routing.service';
import type { ExpenseSubmitCheckResult } from '../types/expense-submit-check.types';
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
import type { ExpenseCategory } from 'src/database/entities/expense.enums';

export const EXPENSE_SERVICE = Symbol('EXPENSE_SERVICE');

export interface IExpenseService {
  create(userId: number, input: CreateExpenseInput): Promise<Expense>;
  findPersonalExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult>;
  findAllExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult>;
  findForApprovalExpenses(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<PaginatedExpensesResult>;
  resolveApprovalBudgetFlags(
    expenses: Expense[],
  ): Promise<
    Map<
      number,
      {
        budgetWouldExceed: boolean;
        requiresOverBudgetAcknowledgment: boolean;
      }
    >
  >;
  resolveApprovalBudgetFlagsForExpense(expense: Expense): Promise<{
    budgetWouldExceed: boolean;
    requiresOverBudgetAcknowledgment: boolean;
  }>;
  getPersonalExpenseStatusCounts(
    authUser: IAuthUser,
  ): Promise<ExpenseStatusCounts>;
  getAllExpenseStatusCounts(authUser: IAuthUser): Promise<ExpenseStatusCounts>;
  buildPersonalExpensesExportCsv(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<string>;
  buildAllExpensesExportCsv(
    authUser: IAuthUser,
    query: ListExpensesQuery,
  ): Promise<string>;
  getPolicyHints(
    authUser: IAuthUser,
    category?: ExpenseCategory,
  ): Promise<ExpensePolicyHint[]>;
  checkDuplicateExpense(
    authUser: IAuthUser,
    input: {
      amount: number;
      category: ExpenseCategory;
      excludeReference?: string;
      windowDays?: number;
    },
  ): Promise<ExpenseDuplicateCheckResult>;
  getPendingApprovalSummary(
    authUser: IAuthUser,
  ): Promise<PendingApprovalSummary>;
  getFinanceQueueSummary(authUser: IAuthUser): Promise<FinanceQueueSummary>;
  buildPayrollExportCsv(authUser: IAuthUser): Promise<string>;
  reopenRejected(authUser: IAuthUser, reference: string): Promise<Expense>;
  bulkReimburse(
    authUser: IAuthUser,
    references: string[],
  ): Promise<BulkReimburseResult>;
  findOne(authUser: IAuthUser, reference: string): Promise<Expense>;
  canActOnApproval(authUser: IAuthUser, expense: Expense): Promise<boolean>;
  buildApprovalChain(expense: Expense): Promise<ApprovalChainStep[]>;
  update(
    authUser: IAuthUser,
    reference: string,
    input: UpdateExpenseInput,
  ): Promise<Expense>;
  remove(authUser: IAuthUser, reference: string): Promise<void>;
  checkSubmitPolicies(
    authUser: IAuthUser,
    reference: string,
  ): Promise<ExpenseSubmitCheckResult>;
  submit(
    authUser: IAuthUser,
    reference: string,
    options?: { policyJustifications?: Record<string, string> },
  ): Promise<Expense>;
  reimburse(authUser: IAuthUser, reference: string): Promise<Expense>;
}
