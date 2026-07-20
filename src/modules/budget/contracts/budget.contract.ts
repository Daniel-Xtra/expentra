import type { EntityManager } from 'typeorm';
import type { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import type { ExpenseBudgetSnapshot } from '../utils/expense-budget-sync.util';
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

export const BUDGET_SERVICE = Symbol('BUDGET_SERVICE');

export type PaginatedBudgetsResult = {
  data: DepartmentBudget[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface IBudgetService {
  create(input: CreateDepartmentBudgetInput): Promise<DepartmentBudget>;
  update(
    reference: string,
    input: UpdateDepartmentBudgetInput,
  ): Promise<DepartmentBudget>;
  findAllBudgets(query: ListBudgetsQuery): Promise<PaginatedBudgetsResult>;
  findOne(reference: string): Promise<DepartmentBudget>;
  getOrganizationSummary(year: number): Promise<OrganizationBudgetSummary>;
  getCommittedByDepartment(year: number): Promise<BudgetByDepartmentRow[]>;
  buildBudgetsExportCsv(query: ListBudgetsQuery): Promise<string>;
  getDepartmentSummary(
    departmentId: number,
    year: number,
  ): Promise<BudgetUsageSummary>;
  getSummaryForUser(
    userId: number,
    year?: number,
  ): Promise<BudgetUsageSummary | null>;
  evaluateExpenseSubmit(
    userId: number,
    amount: number,
    submittedAt?: Date,
    departmentId?: number | null,
  ): Promise<BudgetSubmitEvaluation>;
  evaluateExpenseSubmitInTransaction(
    manager: EntityManager,
    userId: number,
    amount: number,
    submittedAt?: Date,
    departmentId?: number | null,
  ): Promise<BudgetSubmitEvaluation>;
  evaluateExpenseApprove(
    departmentId: number | null | undefined,
    asOf?: Date,
  ): Promise<BudgetApproveEvaluation>;
  emitOverspendIfNeeded(
    evaluation: BudgetSubmitEvaluation,
    context: {
      expenseId: number;
      userId: number;
      departmentId: number;
    },
  ): void;
  recalculateCommittedAmountForDepartmentYear(
    departmentId: number,
    year: number,
    manager?: EntityManager,
  ): Promise<void>;
  syncCommittedAmountForExpenseTransition(
    manager: EntityManager,
    before: ExpenseBudgetSnapshot | null,
    after: ExpenseBudgetSnapshot | null,
  ): Promise<void>;
  syncCommittedAmountForUserDepartmentChange(
    manager: EntityManager,
    userId: number,
    previousDepartmentId?: number | null,
    nextDepartmentId?: number | null,
  ): Promise<void>;
  reconcileAllCommittedAmounts(manager?: EntityManager): Promise<void>;
}
