import { Injectable } from '@nestjs/common';
import { isSuperAdminUser } from 'src/database/constants/system-roles';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import { permissionGrants } from '../matching/permission-grants';
import type { AuthUserPermission } from '../types/auth-user.types';

@Injectable()
export class PermissionEvaluatorService {
  canManageAll(authUser: IAuthUser): boolean {
    return (
      isSuperAdminUser(authUser) ||
      this.hasPermission(
        authUser,
        PermissionAction.MANAGE,
        PermissionResource.ALL,
      )
    );
  }

  hasPermission(
    authUser: IAuthUser,
    action: PermissionAction,
    resource: PermissionResource,
    scope?: PermissionScope,
  ): boolean {
    if (isSuperAdminUser(authUser)) {
      return true;
    }
    return (authUser.permissions as AuthUserPermission[]).some((permission) =>
      permissionGrants(permission, action, resource, scope),
    );
  }

  hasAnyScope(
    authUser: IAuthUser,
    action: PermissionAction,
    resource: PermissionResource,
    scopes: readonly PermissionScope[],
  ): boolean {
    return scopes.some((scope) =>
      this.hasPermission(authUser, action, resource, scope),
    );
  }
}
