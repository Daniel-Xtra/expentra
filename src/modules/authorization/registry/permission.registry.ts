import type { PermissionSeed } from 'src/database/seeders/data/permissions.seed-data';
import { PERMISSION_SEEDS } from 'src/database/seeders/data/permissions.seed-data';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import { capabilitiesForPermission } from './permission-capability.rules';
import type { AuthUserPermission } from '../types/auth-user.types';

export type PermissionRegistryEntry = PermissionSeed & {
  /** Frontend capability keys derived from this permission. */
  capabilities: readonly string[];
};

const byName = new Map<string, PermissionRegistryEntry>();

for (const seed of PERMISSION_SEEDS) {
  const permission: AuthUserPermission = {
    action: seed.action,
    resource: seed.resource,
    scope: seed.scope ?? PermissionScope.GLOBAL,
  };
  byName.set(seed.name, {
    ...seed,
    capabilities: capabilitiesForPermission(permission),
  });
}

/** Canonical permission catalog — keep in sync with seeds and capability rules. */
export const PERMISSION_REGISTRY: readonly PermissionRegistryEntry[] = [
  ...byName.values(),
];

export function findPermissionByName(
  name: string,
): PermissionRegistryEntry | undefined {
  return byName.get(name);
}

export function requirePermissionByName(name: string): PermissionRegistryEntry {
  const entry = findPermissionByName(name);
  if (!entry) {
    throw new Error(`Unknown permission name: ${name}`);
  }
  return entry;
}

export function listAllCapabilityKeys(): string[] {
  const keys = new Set<string>();
  for (const entry of PERMISSION_REGISTRY) {
    for (const capability of entry.capabilities) {
      keys.add(capability);
    }
  }
  keys.add('*');
  return [...keys].sort();
}

export function permissionTupleFromName(name: string): {
  action: PermissionAction;
  resource: PermissionResource;
  scope?: PermissionScope;
} {
  const entry = requirePermissionByName(name);
  return {
    action: entry.action,
    resource: entry.resource,
    scope: entry.scope,
  };
}
