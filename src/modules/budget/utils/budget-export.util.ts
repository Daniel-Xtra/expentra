import type { DepartmentBudget } from 'src/database/entities/department-budget.entity';

function escapeCsvCell(value: string | number | boolean): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatNairaFromKobo(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

export function buildBudgetListExportCsv(budgets: DepartmentBudget[]): string {
  const headers = [
    'Reference',
    'Department',
    'Department Code',
    'Year',
    'Limit (NGN)',
    'Committed (NGN)',
    'Reimbursed (NGN)',
    'Remaining (NGN)',
    'Utilization %',
    'Over Budget',
    'Active',
    'Created At',
    'Updated At',
  ];

  const rows = budgets.map((budget) => [
    budget.reference,
    budget.department?.name ?? '',
    budget.department?.code ?? '',
    budget.year,
    formatNairaFromKobo(budget.amountLimit),
    formatNairaFromKobo(budget.committedAmount),
    formatNairaFromKobo(budget.reimbursedAmount),
    formatNairaFromKobo(budget.remainingAmount),
    budget.utilizationPercent.toFixed(1),
    budget.isOverBudget ? 'Yes' : 'No',
    budget.isActive ? 'Yes' : 'No',
    budget.createdAt.toISOString(),
    budget.updatedAt.toISOString(),
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
}
