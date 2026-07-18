import { OrgGrantType, type OrgGrant } from './org-grant.types';

/** Capability keys granted by organization structure (not role permissions). */
export function capabilitiesForOrgGrants(
  grants: readonly OrgGrant[],
): readonly string[] {
  const caps = new Set<string>();

  if (grants.some((g) => g.type === OrgGrantType.DEPARTMENT_MANAGER)) {
    caps.add('approval:approve');
    caps.add('approval:reject');
    caps.add('approval:approve:department');
    caps.add('approval:reject:department');
    caps.add('approval:read');
    caps.add('expense:read:submitted');
    caps.add('department:read:managed');
    caps.add('dashboard:read:team');
  }

  return [...caps];
}
