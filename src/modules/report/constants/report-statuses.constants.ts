import { ExpenseStatus } from 'src/database/entities/expense.enums';
import { ReportSpendMode } from './report-spend-mode.enum';

/** Approved/reimbursed only — default spending report scope. */
export const REPORT_SETTLED_STATUSES: ExpenseStatus[] = [
  ExpenseStatus.APPROVED,
  ExpenseStatus.REIMBURSED,
];

/** Includes in-flight pipeline statuses when `includePipeline` / mode=pipeline. */
export const REPORT_PIPELINE_STATUSES: ExpenseStatus[] = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
  ExpenseStatus.APPROVED,
  ExpenseStatus.REIMBURSED,
];

/** Approved but not yet reimbursed — unpaid liability for the period. */
export const REPORT_APPROVED_UNPAID_STATUSES: ExpenseStatus[] = [
  ExpenseStatus.APPROVED,
];

export function resolveReportStatuses(options: {
  mode?: ReportSpendMode;
  includePipeline?: boolean;
}): ExpenseStatus[] {
  if (options.mode === ReportSpendMode.PIPELINE) {
    return REPORT_PIPELINE_STATUSES;
  }
  if (options.mode === ReportSpendMode.APPROVED_UNPAID) {
    return REPORT_APPROVED_UNPAID_STATUSES;
  }
  if (options.mode === ReportSpendMode.SETTLED) {
    return REPORT_SETTLED_STATUSES;
  }
  return options.includePipeline
    ? REPORT_PIPELINE_STATUSES
    : REPORT_SETTLED_STATUSES;
}
