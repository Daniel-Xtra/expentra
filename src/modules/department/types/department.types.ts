import { Department } from 'src/database/entities/department.entity';
import type { DepartmentManagerHistory } from 'src/database/entities/department-manager-history.entity';
import type { User } from 'src/database/entities/user.entity';
import type { DepartmentListExtras } from './department-response.types';

export type CreateDepartmentInput = {
  name: string;
  code: string;
  isActive?: boolean;
  managerReference?: string | null;
};

export type UpdateDepartmentInput = {
  name?: string;
  code?: string;
  isActive?: boolean;
  managerReference?: string | null;
};

export type DepartmentListSortField =
  | 'name'
  | 'createdAt'
  | 'headcount'
  | 'utilizationPercent'
  | 'pendingApprovals';

export type DepartmentListSortOrder = 'ASC' | 'DESC';

export type DepartmentHealthFilter =
  | 'over_budget'
  | 'near_limit'
  | 'within_limit';

export type ListDepartmentsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  missingManager?: boolean;
  year?: number;
  sortBy?: DepartmentListSortField;
  sortOrder?: DepartmentListSortOrder;
  healthFilter?: DepartmentHealthFilter;
};

export type PaginatedDepartmentsResult = {
  data: Department[];
  extrasByDepartmentId: Map<number, DepartmentListExtras>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ListDepartmentUsersQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PaginatedDepartmentUsersResult = {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ListDepartmentManagerHistoryQuery = {
  page?: number;
  limit?: number;
};

export type PaginatedDepartmentManagerHistoryResult = {
  data: DepartmentManagerHistory[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
