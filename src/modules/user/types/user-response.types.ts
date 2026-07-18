export type RoleRef = {
  reference: string;
  name: string;
};

export type DepartmentRef = {
  reference: string;
  name: string;
  code: string;
};

export type UserResponse = {
  reference: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  deactivatedAt?: Date | string | null;
  role: RoleRef | null;
  department: DepartmentRef | null;
  isDepartmentManager?: boolean;
  createdAt?: string;
  updatedAt?: string;
  emailVerifiedAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UserExpenseStats = {
  year: number;
  totalCount: number;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  reimbursedCount: number;
  totalAmountYtd: number;
  pendingReimbursementAmount: number;
};

export type UserRecentExpense = {
  reference: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
};

export type OrgGrantRef = {
  type: 'department_manager';
  label?: string;
  reference?: string;
};

export type UserDetailSummary = {
  user: UserResponse;
  managedDepartments: DepartmentRef[];
  orgGrants: OrgGrantRef[];
  expenseStats: UserExpenseStats;
  recentExpenses: UserRecentExpense[];
};

export type UserStatusCounts = {
  total: number;
  active: number;
  inactive: number;
  unassignedDepartment: number;
};
