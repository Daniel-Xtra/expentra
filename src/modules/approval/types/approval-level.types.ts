import type { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';

export type CreateApprovalLevelInput = {
  approverType: ApprovalApproverType;
  roleReference?: string;
  name: string;
  level: number;
  minimumAmount?: number;
  maximumAmount?: number | null;
  isActive?: boolean;
  description?: string | null;
};

export type UpdateApprovalLevelInput = {
  approverType?: ApprovalApproverType;
  roleReference?: string;
  name?: string;
  level?: number;
  minimumAmount?: number;
  maximumAmount?: number | null;
  isActive?: boolean;
  description?: string | null;
};

export type ListApprovalLevelsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  roleReference?: string;
  approverType?: ApprovalApproverType;
};

export type PaginatedApprovalLevelsResult = {
  data: ApprovalLevel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
