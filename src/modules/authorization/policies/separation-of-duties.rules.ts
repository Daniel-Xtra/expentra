import { ForbiddenException } from '@nestjs/common';
import type { Permission } from 'src/database/entities/permission.entity';

/** Permission pairs that must not coexist on a single role (separation of duties). */
export const SEPARATION_OF_DUTIES_CONFLICTS: readonly [string, string][] = [
  ['expense.submit', 'approval.approve'],
  ['expense.submit', 'approval.reject'],
] as const;

export function assertNoSeparationOfDutiesConflicts(
  permissions: Pick<Permission, 'name'>[],
): void {
  const names = new Set(permissions.map((permission) => permission.name));

  for (const [left, right] of SEPARATION_OF_DUTIES_CONFLICTS) {
    if (names.has(left) && names.has(right)) {
      throw new ForbiddenException(
        `Permissions "${left}" and "${right}" cannot be assigned to the same role (separation of duties)`,
      );
    }
  }
}
