import { findRoleTemplate, listRoleTemplates } from '../data/role-templates';

describe('role templates', () => {
  it('lists known templates', () => {
    const keys = listRoleTemplates().map((template) => template.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'staff',
        'hr_admin',
        'finance_manager',
        'platform_admin',
      ]),
    );
  });

  it('does not include user.create in hr_admin template', () => {
    const template = findRoleTemplate('hr_admin');
    expect(template?.permissionNames).not.toContain('user.create');
    expect(template?.permissionNames).toEqual(
      expect.arrayContaining(['user.read', 'user.update']),
    );
  });
});
