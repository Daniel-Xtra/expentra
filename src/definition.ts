export interface IAuthUser {
  id: number;
  reference: string;
  email: string;
  role: string;
  roleId: number;
  isActive: boolean;
  deactivatedAt?: Date;
  isEmailVerified: boolean;
  departmentId?: number | null;
  /** Departments this user manages (department.manager_id). */
  managedDepartmentIds: number[];
  permissions: {
    action: string;
    resource: string;
    scope: string;
  }[];
}
