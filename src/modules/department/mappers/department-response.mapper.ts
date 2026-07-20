import type { Department } from 'src/database/entities/department.entity';
import type { User } from 'src/database/entities/user.entity';

export type DepartmentManagerResponse = {
  reference: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

export type DepartmentResponse = {
  reference: string;
  name: string;
  code: string;
  isActive: boolean;
  hasManager: boolean;
  pendingApprovalCount: number;
  headcount?: number;
  hasBudget?: boolean;
  utilizationPercent?: number | null;
  isOverBudget?: boolean;
  isNearLimit?: boolean;
  manager: DepartmentManagerResponse | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DepartmentResponseExtras = {
  pendingApprovalCount?: number;
  headcount?: number;
  hasBudget?: boolean;
  utilizationPercent?: number | null;
  isOverBudget?: boolean;
  isNearLimit?: boolean;
};

function toDepartmentManagerResponse(manager: User): DepartmentManagerResponse {
  return {
    reference: manager.reference,
    email: manager.email,
    firstName: manager.firstName ?? null,
    lastName: manager.lastName ?? null,
    avatarUrl: manager.avatarUrl ?? null,
  };
}

export function toDepartmentResponse(
  department: Department,
  extras?: DepartmentResponseExtras,
): DepartmentResponse {
  return {
    reference: department.reference,
    name: department.name,
    code: department.code,
    isActive: department.isActive,
    hasManager: department.managerId != null,
    pendingApprovalCount: extras?.pendingApprovalCount ?? 0,
    headcount: extras?.headcount,
    hasBudget: extras?.hasBudget,
    utilizationPercent: extras?.utilizationPercent,
    isOverBudget: extras?.isOverBudget,
    isNearLimit: extras?.isNearLimit,
    manager: department.manager
      ? toDepartmentManagerResponse(department.manager)
      : null,
    metadata: department.metadata ?? null,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}
