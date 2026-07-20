import type { AppAbility } from '../ability/app-ability';
import { PermissionAction, PermissionResource } from '../constants/permissions';

/** Route policy: user can approve or reject expenses (role or org grant). */
export function canDecideOnApprovalAbility(ability: AppAbility): boolean {
  return (
    ability.can(PermissionAction.APPROVE, PermissionResource.APPROVAL) ||
    ability.can(PermissionAction.REJECT, PermissionResource.APPROVAL)
  );
}

/** Route policy: user can access managed-department endpoints (manager org grant). */
export function canReadManagedDepartments(ability: AppAbility): boolean {
  return ability.managesAnyDepartment();
}
