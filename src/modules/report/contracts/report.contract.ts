import type { IAuthUser } from 'src/definition';
import type {
  CategorySpendingRow,
  DepartmentSpendingRow,
  ExpenseExportRow,
  SpendingReportQuery,
  SpendingSummaryReport,
  YearlyMonthlySpendingReport,
  YearlySpendingQuery,
} from '../types/report.types';

export const REPORT_SERVICE = Symbol('REPORT_SERVICE');

export interface IReportService {
  getSpendingSummary(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<SpendingSummaryReport>;
  getSpendingByCategory(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<CategorySpendingRow[]>;
  getSpendingByDepartment(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<DepartmentSpendingRow[]>;
  getSpendingByMonth(
    authUser: IAuthUser,
    query: YearlySpendingQuery,
  ): Promise<YearlyMonthlySpendingReport>;
  getExpenseExportRows(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<ExpenseExportRow[]>;
  buildExpensesCsv(rows: ExpenseExportRow[]): string;
  buildSpendingReportPdf(
    authUser: IAuthUser,
    query: SpendingReportQuery,
  ): Promise<Buffer>;
}
