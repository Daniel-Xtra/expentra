import type { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';

export type ApprovalLevelStatusCounts = {
  total: number;
  active: number;
  inactive: number;
  departmentManager: number;
  financeManager: number;
};

export type ApprovalLevelHealthWarning = {
  code: string;
  title: string;
  description: string;
  destructive?: boolean;
};

export type ApprovalLevelWorkflowHealth = {
  counts: ApprovalLevelStatusCounts;
  warnings: ApprovalLevelHealthWarning[];
};

export type ApprovalLevelImpactSummary = {
  pendingExpenseCount: number;
  historicalDecisionCount: number;
};

export type ApprovalLevelListExtras = {
  pendingExpenseCount: number;
};
