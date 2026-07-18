import { AbilityBuilder } from '../ability/ability.builder';
import { AppAbility } from '../ability/app-ability';
import {
  PermissionAction,
  PermissionResource,
} from '../constants/permissions';
import { canDecideOnApprovalAbility, canReadManagedDepartments } from './policy-handlers';

describe('canDecideOnApprovalAbility', () => {
  it('returns true when approve rule is present', () => {
    const builder = new AbilityBuilder();
    builder.can(PermissionAction.APPROVE, PermissionResource.APPROVAL);
    const ability = builder.build();

    expect(canDecideOnApprovalAbility(ability)).toBe(true);
  });

  it('returns false without approval rules or permissions', () => {
    const ability = new AppAbility([], []);
    expect(canDecideOnApprovalAbility(ability)).toBe(false);
  });
});

describe('canReadManagedDepartments', () => {
  it('returns true when user manages departments', () => {
    const ability = new AppAbility([], [], { managedDepartmentIds: [3] } as never);
    expect(canReadManagedDepartments(ability)).toBe(true);
  });

  it('returns false when user manages no departments', () => {
    const ability = new AppAbility([], [], { managedDepartmentIds: [] } as never);
    expect(canReadManagedDepartments(ability)).toBe(false);
  });
});
