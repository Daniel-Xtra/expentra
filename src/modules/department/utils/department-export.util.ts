import type { Department } from 'src/database/entities/department.entity';
import type { DepartmentListExtras } from '../types/department-response.types';

function escapeCsvCell(value: string | number | boolean): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatBudgetHealth(extras: DepartmentListExtras): string {
  if (!extras.hasBudget) {
    return 'No budget';
  }
  if (extras.isOverBudget) {
    return 'Over budget';
  }
  if (extras.isNearLimit) {
    return 'Near limit';
  }
  return 'Within limit';
}

export function buildDepartmentListExportCsv(
  departments: Department[],
  extrasById: Map<number, DepartmentListExtras>,
): string {
  const headers = [
    'Reference',
    'Name',
    'Code',
    'Manager Email',
    'Headcount',
    'Pending Approvals',
    'Budget Health',
    'Utilization %',
    'Active',
    'Created At',
    'Updated At',
  ];

  const rows = departments.map((department) => {
    const extras = extrasById.get(department.id) ?? {
      headcount: 0,
      pendingApprovalCount: 0,
      hasBudget: false,
      utilizationPercent: null,
      isOverBudget: false,
      isNearLimit: false,
    };

    return [
      department.reference,
      department.name,
      department.code,
      department.manager?.email ?? '',
      extras.headcount,
      extras.pendingApprovalCount,
      formatBudgetHealth(extras),
      extras.utilizationPercent != null
        ? extras.utilizationPercent.toFixed(1)
        : '',
      department.isActive ? 'Yes' : 'No',
      department.createdAt.toISOString(),
      department.updatedAt.toISOString(),
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
}
