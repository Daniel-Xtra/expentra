import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';

function escapeCsvCell(value: string | number | boolean): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatAmountRange(
  minimumAmount: number,
  maximumAmount?: number | null,
): string {
  if (minimumAmount <= 0 && (maximumAmount == null || maximumAmount <= 0)) {
    return 'All amounts';
  }
  if (maximumAmount == null) {
    return `>= ${minimumAmount}`;
  }
  return `${minimumAmount} - ${maximumAmount}`;
}

export function buildApprovalLevelExportCsv(levels: ApprovalLevel[]): string {
  const headers = [
    'Reference',
    'Name',
    'Level Order',
    'Approver Type',
    'Role',
    'Minimum Amount (kobo)',
    'Maximum Amount (kobo)',
    'Amount Range',
    'Active',
    'Description',
    'Created At',
    'Updated At',
  ];

  const rows = levels.map((level) => [
    level.reference,
    level.name,
    level.level,
    level.approverType,
    level.role?.name ?? '',
    level.minimumAmount,
    level.maximumAmount ?? '',
    formatAmountRange(level.minimumAmount, level.maximumAmount),
    level.isActive ? 'Yes' : 'No',
    level.description ?? '',
    level.createdAt.toISOString(),
    level.updatedAt.toISOString(),
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
}
