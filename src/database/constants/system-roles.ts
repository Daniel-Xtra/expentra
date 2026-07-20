/**
 * Well-known role names used in domain logic and seeds.
 */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  STAFF: 'staff',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export function isSuperAdminUser(user: { role?: string }): boolean {
  return user.role === SYSTEM_ROLES.SUPER_ADMIN;
}

/** @deprecated Use {@link isSuperAdminUser} */
export function isAdminRole(role: string | undefined): boolean {
  return role === SYSTEM_ROLES.SUPER_ADMIN;
}
