import { isSuperAdminUser } from 'src/database/constants/system-roles';
import type { IAuthUser } from 'src/definition';
import { capabilitiesForOrgGrants } from './org-grants/org-grant.capabilities';
import type { OrgGrant } from './org-grants/org-grant.types';
import { capabilitiesForPermission } from './registry/permission-capability.rules';
import type { AuthUserPermission } from './types/auth-user.types';

/** Frontend-facing capability keys derived from role permissions and org grants. */
export function capabilitiesFromAuthContext(
  authUser: IAuthUser,
  orgGrants: readonly OrgGrant[] = [],
): readonly string[] {
  if (isSuperAdminUser(authUser)) {
    const caps = new Set<string>(['*']);
    for (const capability of capabilitiesForOrgGrants(orgGrants)) {
      caps.add(capability);
    }
    return [...caps];
  }

  const caps = new Set<string>();
  const permissions = authUser.permissions as AuthUserPermission[];

  for (const permission of permissions) {
    for (const capability of capabilitiesForPermission(permission)) {
      caps.add(capability);
    }
  }

  for (const capability of capabilitiesForOrgGrants(orgGrants)) {
    caps.add(capability);
  }

  return [...caps];
}

/** @deprecated Use {@link capabilitiesFromAuthContext} with explicit org grants. */
export function capabilitiesFromPermissions(
  authUser: IAuthUser,
): readonly string[] {
  return capabilitiesFromAuthContext(authUser);
}
