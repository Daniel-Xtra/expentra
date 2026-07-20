// Constants
export {
  ParentPermissionResource,
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from './constants/permissions';

// Types
export type { AuthUserPermission } from './types/auth-user.types';
export type {
  AbilityRule,
  AppAction,
  AppSubject,
  ExpenseInstanceChecker,
} from './types/ability.types';
export type {
  ExpenseDraftMutation,
  ExpenseListVisibility,
} from './types/policy.types';

// HTTP layer
export { AppAbility } from './ability/app-ability';
export { AbilityFactory } from './ability/ability.factory';
export { AccessGuard } from './guards/access.guard';
export { AllowAuthenticated } from 'src/core/decorators/allow-authenticated.decorator';
export {
  CheckPolicies,
  POLICIES_KEY,
  type PolicyHandler,
} from './decorators/check-policies.decorator';
export {
  RequirePermission,
  RequirePermissionByName,
  RequireAnyPermission,
  RequireAnyPermissionByName,
  RequireManagedDepartmentRead,
} from './decorators/require-permission.decorator';

// Org grants
export { OrgGrantType, type OrgGrant } from './org-grants/org-grant.types';
export {
  hasOrgGrant,
  isDepartmentManager,
  resolveOrgGrants,
} from './org-grants/org-grant.resolver';
export { capabilitiesForOrgGrants } from './org-grants/org-grant.capabilities';

// Policy handlers
export {
  canDecideOnApprovalAbility,
  canReadManagedDepartments,
} from './policies/policy-handlers';
export { assertCanAssignRole } from './policies/role-assignment.policy';

// Service layer
export { AccessPolicyService } from './services/access-policy.service';
export { PermissionAssignmentPolicy } from './services/permission-assignment.policy';
export { PermissionEvaluatorService } from './services/permission-evaluator.service';
export { AuthorizationService } from './services/authorization.service';

// Domain policies (exported for testing/extension)
export { ApprovalAccessPolicy } from './policies/approval-access.policy';
export { ExpenseAccessPolicy } from './policies/expense-access.policy';

// Matching primitives
export {
  permissionGrants,
  permissionScopeAllows,
} from './matching/permission-grants';
export {
  canAccessScopedSubject,
  subjectMatchesScope,
  type ScopedSubject,
} from './matching/scope-access';

// Mappers & client capabilities
export { mapPermissionsFromRole, toAuthUser } from './mappers/auth-user.mapper';
export {
  capabilitiesFromAuthContext,
  capabilitiesFromPermissions,
} from './capabilities';
export { capabilitiesForPermission } from './registry/permission-capability.rules';
export {
  PERMISSION_REGISTRY,
  findPermissionByName,
  listAllCapabilityKeys,
} from './registry/permission.registry';
