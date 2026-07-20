import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import type { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';

export type ApprovalLevelRoleResponse = {
  reference: string;
  name: string;
};

export type ApprovalLevelResponse = {
  reference: string;
  approverType: ApprovalApproverType;
  role?: ApprovalLevelRoleResponse;
  name: string;
  level: number;
  minimumAmount: number;
  maximumAmount?: number | null;
  isActive: boolean;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toApprovalLevelResponse(
  approvalLevel: ApprovalLevel,
): ApprovalLevelResponse {
  return {
    reference: approvalLevel.reference,
    approverType: approvalLevel.approverType,
    role: approvalLevel.role
      ? {
          reference: approvalLevel.role.reference,
          name: approvalLevel.role.name,
        }
      : undefined,
    name: approvalLevel.name,
    level: approvalLevel.level,
    minimumAmount: approvalLevel.minimumAmount,
    maximumAmount: approvalLevel.maximumAmount ?? null,
    isActive: approvalLevel.isActive,
    description: approvalLevel.description ?? null,
    metadata: approvalLevel.metadata ?? null,
    createdAt: approvalLevel.createdAt,
    updatedAt: approvalLevel.updatedAt,
  };
}
