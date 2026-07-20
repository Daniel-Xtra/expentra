/** Organization-level grants derived from structure, not role permissions. */
export enum OrgGrantType {
  DEPARTMENT_MANAGER = 'department_manager',
}

export type OrgGrant = {
  type: OrgGrantType;
  /** Human-readable label for admin UI (e.g. department name). */
  label?: string;
  /** Related entity reference when applicable. */
  reference?: string;
};
