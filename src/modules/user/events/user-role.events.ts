export const USER_ROLE_CHANGED_EVENT = 'user.role_changed';

export type UserRoleChangedEvent = {
  actorUserId: number;
  userReference: string;
  previousRoleReference: string | null;
  nextRoleReference: string;
};
