import type { User } from 'src/database/entities/user.entity';
import type { DepartmentRef, UserResponse } from '../types/user-response.types';

export type {
  DepartmentRef,
  RoleRef,
  UserDetailSummary,
  UserExpenseStats,
  UserRecentExpense,
  UserResponse,
  UserStatusCounts,
} from '../types/user-response.types';

type UserResponseOptions = {
  isDepartmentManager?: boolean;
};

export function toUserResponse(
  user: User,
  options: UserResponseOptions = {},
): UserResponse {
  return {
    reference: user.reference,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl ?? null,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    deactivatedAt: user.deactivatedAt ?? null,
    role: user.role
      ? { reference: user.role.reference, name: user.role.name }
      : null,
    department: user.department
      ? {
          reference: user.department.reference,
          name: user.department.name,
          code: user.department.code,
        }
      : null,
    isDepartmentManager: options.isDepartmentManager,
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    metadata: user.metadata ?? null,
  };
}

export function toDepartmentRefs(
  departments: Array<{ reference: string; name: string; code: string }>,
): DepartmentRef[] {
  return departments.map((department) => ({
    reference: department.reference,
    name: department.name,
    code: department.code,
  }));
}
