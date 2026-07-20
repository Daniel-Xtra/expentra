import type { User } from 'src/database/entities/user.entity';

function escapeCsvCell(value: string | number | boolean): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildUserListExportCsv(users: User[]): string {
  const headers = [
    'Reference',
    'Email',
    'First Name',
    'Last Name',
    'Department',
    'Department Code',
    'Role',
    'Active',
    'Email Verified',
    'Created At',
    'Updated At',
  ];

  const rows = users.map((user) => [
    user.reference,
    user.email,
    user.firstName ?? '',
    user.lastName ?? '',
    user.department?.name ?? '',
    user.department?.code ?? '',
    user.role?.name ?? '',
    user.isActive ? 'Yes' : 'No',
    user.isEmailVerified ? 'Yes' : 'No',
    user.createdAt.toISOString(),
    user.updatedAt.toISOString(),
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
}
