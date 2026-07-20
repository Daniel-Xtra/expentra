import { isSuperAdminUser } from 'src/database/constants/system-roles';
import type { IAuthUser } from 'src/definition';
import { PermissionScope } from '../constants/permissions';

export type ScopedSubject = {
  userId: number;
};

export function subjectMatchesScope(
  authUser: IAuthUser,
  subject: ScopedSubject,
  scope: PermissionScope,
): boolean {
  switch (scope) {
    case PermissionScope.GLOBAL:
      return true;
    case PermissionScope.SELF:
      return subject.userId === authUser.id;
    default:
      return false;
  }
}

export function canAccessScopedSubject(
  authUser: IAuthUser,
  subject: ScopedSubject,
  hasPermission: (scope: PermissionScope) => boolean,
  options?: { manageAll?: boolean },
): boolean {
  if (
    isSuperAdminUser(authUser) ||
    options?.manageAll ||
    hasPermission(PermissionScope.GLOBAL)
  ) {
    return true;
  }

  if (hasPermission(PermissionScope.SELF)) {
    return subjectMatchesScope(authUser, subject, PermissionScope.SELF);
  }

  return false;
}
