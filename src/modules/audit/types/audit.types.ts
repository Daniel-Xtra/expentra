import type {
  AuditAction,
  AuditResourceType,
} from 'src/database/entities/audit-log.enums';

export type RecordAuditInput = {
  actorId?: number | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceReference: string;
  metadata?: Record<string, unknown>;
};

export type ListAuditLogsQuery = {
  resourceReference?: string;
  action?: AuditAction;
  actorReference?: string;
  actorEmail?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type PaginatedAuditLogsResult = {
  data: import('src/database/entities/audit-log.entity').AuditLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
