import { ForbiddenException } from '@nestjs/common';
import {
  isSuperAdminUser,
  SYSTEM_ROLES,
} from 'src/database/constants/system-roles';
import { Role } from 'src/database/entities/role.entity';
import type { IAuthUser } from 'src/definition';

export function assertCanAssignRole(actor: IAuthUser, role: Role): void {
  if (role.name !== SYSTEM_ROLES.SUPER_ADMIN) {
    return;
  }

  if (!isSuperAdminUser(actor)) {
    throw new ForbiddenException(
      'Only super administrators can assign the super admin role',
    );
  }
}
