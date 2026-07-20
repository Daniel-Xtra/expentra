import { buildCsv } from 'src/modules/report/utils/csv-export.util';
import type { PayrollExportRow } from '../types/expense.types';

const PAYROLL_HEADERS = [
  'Employee Email',
  'Employee Name',
  'Expense Reference',
  'Title',
  'Amount',
  'Currency',
  'Department',
  'Approved Date',
  'Narration',
];

export function buildPayrollExportCsv(rows: PayrollExportRow[]): string {
  return buildCsv(
    PAYROLL_HEADERS,
    rows.map((row) => [
      row.employeeEmail,
      row.employeeName,
      row.expenseReference,
      row.title,
      row.amountMajor,
      row.currency,
      row.departmentName,
      row.approvedAt,
      row.narration,
    ]),
  );
}

export function formatAmountMajor(amountKobo: number): string {
  return (amountKobo / 100).toFixed(2);
}
