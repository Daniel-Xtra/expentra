import type { User } from 'src/database/entities/user.entity';

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  departmentReference?: string;
  roleReference?: string;
  isActive?: boolean;
  unassignedDepartment?: boolean;
}

export interface PaginatedUsersMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsersResult {
  data: User[];
  meta: PaginatedUsersMeta;
}

export interface CreateUserWithHashInput {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AdminUpdateUserInput {
  roleReference?: string;
  departmentReference?: string | null;
  isActive?: boolean;
}

export interface SuspendUserInput {
  actorId: number;
  targetUserId: number;
}
