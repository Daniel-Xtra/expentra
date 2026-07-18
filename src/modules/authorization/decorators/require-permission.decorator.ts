import {
  PermissionAction,
  PermissionResource,
} from '../constants/permissions';
import { canReadManagedDepartments } from '../policies/policy-handlers';
import { permissionTupleFromName } from '../registry/permission.registry';
import { CheckPolicies } from './check-policies.decorator';

/** Shorthand for `@CheckPolicies((a) => a.can(action, resource))`. */
export const RequirePermission = (
  action: PermissionAction,
  resource: PermissionResource,
) => CheckPolicies((ability) => ability.can(action, resource));

/**
 * Shorthand using canonical permission name from the registry
 * (e.g. `user.create`, `audit.read`).
 */
export const RequirePermissionByName = (permissionName: string) => {
  const { action, resource } = permissionTupleFromName(permissionName);
  return RequirePermission(action, resource);
};

/** Pass if the ability satisfies any of the given action/resource pairs. */
export const RequireAnyPermission = (
  ...requirements: ReadonlyArray<readonly [PermissionAction, PermissionResource]>
) =>
  CheckPolicies((ability) =>
    requirements.some(([action, resource]) => ability.can(action, resource)),
  );

/** Pass if the ability satisfies any of the given registry permission names. */
export const RequireAnyPermissionByName = (...permissionNames: string[]) =>
  CheckPolicies((ability) =>
    permissionNames.some((name) => {
      const { action, resource } = permissionTupleFromName(name);
      return ability.can(action, resource);
    }),
  );

/** Pass for department managers accessing managed-department routes. */
export const RequireManagedDepartmentRead = () =>
  CheckPolicies((ability) => canReadManagedDepartments(ability));
