export type UserDepartmentChangedEvent = {
  actorUserId: number;
  userId: number;
  userReference: string;
  previousDepartmentId?: number;
  nextDepartmentId?: number;
  previousDepartmentReference: string | null;
  nextDepartmentReference: string | null;
};

export const USER_DEPARTMENT_CHANGED_EVENT = 'user.department_changed';
