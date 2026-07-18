import { buildCsv } from 'src/modules/report/utils/csv-export.util';
import { toExportIsoDate } from 'src/modules/report/utils/date-export.util';
import type { Expense } from 'src/database/entities/expense.entity';
import { formatAmountMajor } from './payroll-export.util';

const EXPORT_HEADERS = [
  'Reference',
  'Title',
  'Amount',
  'Currency',
  'Category',
  'Status',
  'Employee Email',
  'Department',
  'Incurred Date',
  'Submitted',
  'Updated',
  'Approved',
  'Reimbursed',
  'Reimbursement Reference',
];

export function buildExpenseListExportCsv(expenses: Expense[]): string {
  const rows = expenses.map((expense) => [
    expense.reference,
    expense.title,
    formatAmountMajor(expense.amount),
    expense.currency,
    expense.category,
    expense.status,
    expense.user?.email ?? '',
    expense.department?.name ?? '',
    expense.incurredAt ? toExportIsoDate(expense.incurredAt) : '',
    expense.submittedAt ? toExportIsoDate(expense.submittedAt) : '',
    toExportIsoDate(expense.updatedAt),
    expense.approvedAt ? toExportIsoDate(expense.approvedAt) : '',
    expense.reimbursedAt ? toExportIsoDate(expense.reimbursedAt) : '',
    expense.reimbursementReference ?? '',
  ]);

  return buildCsv(EXPORT_HEADERS, rows);
}
