export type DepartmentManagerChangedEvent = {
  actorUserId?: number;
  departmentId: number;
  departmentReference: string;
  previousManagerId: number | null;
  nextManagerId: number | null;
  previousManagerReference: string | null;
  nextManagerReference: string | null;
};

export const DEPARTMENT_MANAGER_CHANGED_EVENT = 'department.manager_changed';
