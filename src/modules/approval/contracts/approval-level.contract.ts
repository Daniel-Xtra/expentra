import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import type {
  CreateApprovalLevelInput,
  ListApprovalLevelsQuery,
  PaginatedApprovalLevelsResult,
  UpdateApprovalLevelInput,
} from '../types/approval-level.types';
import type {
  ApprovalLevelImpactSummary,
  ApprovalLevelWorkflowHealth,
} from '../types/approval-level-response.types';

export const APPROVAL_LEVEL_SERVICE = Symbol('APPROVAL_LEVEL_SERVICE');

export interface IApprovalLevelService {
  create(input: CreateApprovalLevelInput): Promise<ApprovalLevel>;
  findAllApprovalLevels(
    query: ListApprovalLevelsQuery,
  ): Promise<PaginatedApprovalLevelsResult>;
  findOne(reference: string): Promise<ApprovalLevel>;
  update(
    reference: string,
    input: UpdateApprovalLevelInput,
  ): Promise<ApprovalLevel>;
  remove(reference: string): Promise<void>;
  getWorkflowHealth(): Promise<ApprovalLevelWorkflowHealth>;
  getImpactSummary(reference: string): Promise<ApprovalLevelImpactSummary>;
  buildApprovalLevelsExportCsv(query: ListApprovalLevelsQuery): Promise<string>;
}
