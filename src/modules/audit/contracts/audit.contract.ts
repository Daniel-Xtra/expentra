import type { AuditLog } from 'src/database/entities/audit-log.entity';
import type {
  ListAuditLogsQuery,
  PaginatedAuditLogsResult,
  RecordAuditInput,
} from '../types/audit.types';

export const AUDIT_SERVICE = Symbol('AUDIT_SERVICE');

export interface IAuditService {
  record(input: RecordAuditInput): Promise<AuditLog>;
  findAll(query: ListAuditLogsQuery): Promise<PaginatedAuditLogsResult>;
  findForResource(resourceReference: string): Promise<AuditLog[]>;
}
