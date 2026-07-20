import { APPROVAL_ROLES } from '../../constants/approval-roles';
import { SYSTEM_ROLES } from '../../constants/system-roles';
import type { RoleDefinition } from './roles.seed-data.types';

export type { RoleDefinition } from './roles.seed-data.types';

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: SYSTEM_ROLES.SUPER_ADMIN,
    description: 'Platform super administrator with full access',
  },
  {
    name: SYSTEM_ROLES.STAFF,
    description: 'Default role for staff submitting expenses',
  },
  {
    name: APPROVAL_ROLES.FINANCE_MANAGER,
    description: 'Finance manager who approves submitted expenses',
  },
];
