import type { OrgGrant } from '../org-grants/org-grant.types';

export type AccessReviewRow = {
  userReference: string;
  email: string;
  roleName: string | null;
  departmentName: string | null;
  permissionNames: string[];
  orgGrants: OrgGrant[];
  capabilities: readonly string[];
};

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAccessReviewCsv(rows: AccessReviewRow[]): string {
  const header = [
    'user_reference',
    'email',
    'role',
    'department',
    'permissions',
    'org_grants',
    'capability_count',
  ];

  const lines = rows.map((row) =>
    [
      row.userReference,
      row.email,
      row.roleName ?? '',
      row.departmentName ?? '',
      row.permissionNames.join('; '),
      row.orgGrants
        .map((grant) =>
          grant.label ? `${grant.type}:${grant.label}` : grant.type,
        )
        .join('; '),
      String(row.capabilities.length),
    ]
      .map((cell) => escapeCsv(cell))
      .join(','),
  );

  return [header.join(','), ...lines].join('\n');
}
