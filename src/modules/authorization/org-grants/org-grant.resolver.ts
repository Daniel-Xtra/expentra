import type { IAuthUser } from 'src/definition';
import { OrgGrantType, type OrgGrant } from './org-grant.types';

export type ManagedDepartmentRef = {
  reference: string;
  name: string;
};

/** Resolves organization grants from auth context (department manager, etc.). */
export function resolveOrgGrants(
  authUser: IAuthUser,
  managedDepartments?: readonly ManagedDepartmentRef[],
): OrgGrant[] {
  const grants: OrgGrant[] = [];

  if ((authUser.managedDepartmentIds?.length ?? 0) > 0) {
    if (managedDepartments?.length) {
      for (const department of managedDepartments) {
        grants.push({
          type: OrgGrantType.DEPARTMENT_MANAGER,
          label: department.name,
          reference: department.reference,
        });
      }
    } else {
      grants.push({ type: OrgGrantType.DEPARTMENT_MANAGER });
    }
  }

  return grants;
}

export function hasOrgGrant(
  grants: readonly OrgGrant[],
  type: OrgGrantType,
): boolean {
  return grants.some((grant) => grant.type === type);
}

export function isDepartmentManager(authUser: IAuthUser): boolean {
  return (authUser.managedDepartmentIds?.length ?? 0) > 0;
}
