import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../constants/permissions';
import type { AuthUserPermission } from '../types/auth-user.types';
import { permissionGrants } from './permission-grants';

describe('permissionGrants', () => {
  const userCreate: AuthUserPermission = {
    action: PermissionAction.CREATE,
    resource: PermissionResource.USER,
    scope: PermissionScope.GLOBAL,
  };

  const expenseReadOwn: AuthUserPermission = {
    action: PermissionAction.READ,
    resource: PermissionResource.EXPENSE,
    scope: PermissionScope.SELF,
  };

  it('grants user.create on global user create permission', () => {
    expect(
      permissionGrants(
        userCreate,
        PermissionAction.CREATE,
        PermissionResource.USER,
      ),
    ).toBe(true);
  });

  it('does not grant user.update from user.create', () => {
    expect(
      permissionGrants(
        userCreate,
        PermissionAction.UPDATE,
        PermissionResource.USER,
      ),
    ).toBe(false);
  });

  it('requires matching scope when scope is required', () => {
    expect(
      permissionGrants(
        expenseReadOwn,
        PermissionAction.READ,
        PermissionResource.EXPENSE,
        PermissionScope.GLOBAL,
      ),
    ).toBe(false);
  });

  it('does not grant unscoped budget read from budget.read.own', () => {
    const budgetReadOwn: AuthUserPermission = {
      action: PermissionAction.READ,
      resource: PermissionResource.BUDGET,
      scope: PermissionScope.SELF,
    };

    expect(
      permissionGrants(
        budgetReadOwn,
        PermissionAction.READ,
        PermissionResource.BUDGET,
      ),
    ).toBe(false);

    expect(
      permissionGrants(
        budgetReadOwn,
        PermissionAction.READ,
        PermissionResource.BUDGET,
        PermissionScope.SELF,
      ),
    ).toBe(true);
  });

  it('grants unscoped budget read from global budget.read', () => {
    const budgetRead: AuthUserPermission = {
      action: PermissionAction.READ,
      resource: PermissionResource.BUDGET,
      scope: PermissionScope.GLOBAL,
    };

    expect(
      permissionGrants(
        budgetRead,
        PermissionAction.READ,
        PermissionResource.BUDGET,
      ),
    ).toBe(true);
  });
});
