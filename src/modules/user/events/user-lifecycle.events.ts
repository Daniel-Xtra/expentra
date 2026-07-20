export const USER_SUSPENDED_EVENT = 'user.suspended';
export const USER_ACTIVATED_EVENT = 'user.activated';

export type PendingExpenseSnapshot = {
  reference: string;
  status: string;
  title: string;
};

export type UserSuspendedEvent = {
  actorUserId: number;
  targetUserId: number;
  userReference: string;
  pendingExpenses: PendingExpenseSnapshot[];
  changes: {
    isActive: false;
    deactivatedAt?: Date | null;
  };
};

export type UserActivatedEvent = {
  actorUserId: number;
  targetUserId: number;
  userReference: string;
  changes: {
    isActive: true;
    deactivatedAt: null;
  };
};
