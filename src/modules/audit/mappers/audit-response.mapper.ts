import type { AuditLog } from 'src/database/entities/audit-log.entity';

export type AuditLogResponse = {
  reference: string;
  action: string;
  resourceType: string;
  resourceReference: string;
  metadata: Record<string, unknown>;
  actor?: {
    reference: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  createdAt: Date;
};

export function toAuditLogResponse(log: AuditLog): AuditLogResponse {
  return {
    reference: log.reference,
    action: log.action,
    resourceType: log.resourceType,
    resourceReference: log.resourceReference,
    metadata: log.metadata,
    actor: log.actor
      ? {
          reference: log.actor.reference,
          email: log.actor.email,
          firstName: log.actor.firstName,
          lastName: log.actor.lastName,
        }
      : null,
    createdAt: log.createdAt,
  };
}
