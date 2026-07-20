export type DepartmentManagerHistoryUserRef = {
  reference: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

export type DepartmentManagerHistoryResponse = {
  reference: string;
  manager: DepartmentManagerHistoryUserRef | null;
  assignedBy: DepartmentManagerHistoryUserRef | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
};
