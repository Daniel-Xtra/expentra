import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorrelationContextService } from 'src/core/correlation/correlation-context.service';
import { AuditLog } from 'src/database/entities/audit-log.entity';
import type { IAuditService } from '../contracts/audit.contract';
import type {
  ListAuditLogsQuery,
  PaginatedAuditLogsResult,
  RecordAuditInput,
} from '../types/audit.types';

@Injectable()
export class AuditService implements IAuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  async record(input: RecordAuditInput): Promise<AuditLog> {
    const correlationId = this.correlationContext.get();
    const metadata = {
      ...(input.metadata ?? {}),
      ...(correlationId ? { correlationId } : {}),
    };

    const row = this.auditRepository.create({
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceReference: input.resourceReference,
      metadata,
    });
    return this.auditRepository.save(row);
  }

  async findAll(query: ListAuditLogsQuery): Promise<PaginatedAuditLogsResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor')
      .orderBy('audit.createdAt', 'DESC');

    if (query.resourceReference) {
      qb.andWhere('audit.resourceReference = :resourceReference', {
        resourceReference: query.resourceReference,
      });
    }
    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }
    if (query.actorReference) {
      qb.andWhere('actor.reference = :actorReference', {
        actorReference: query.actorReference,
      });
    }
    if (query.actorEmail?.trim()) {
      qb.andWhere('LOWER(actor.email) LIKE :actorEmail', {
        actorEmail: `%${query.actorEmail.trim().toLowerCase()}%`,
      });
    }
    if (query.from) {
      const fromDate = new Date(query.from);
      if (!Number.isNaN(fromDate.getTime())) {
        qb.andWhere('audit.createdAt >= :fromDate', { fromDate });
      }
    }
    if (query.to) {
      const toDate = new Date(query.to);
      if (!Number.isNaN(toDate.getTime())) {
        // Inclusive end-of-day when date-only (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
          toDate.setUTCHours(23, 59, 59, 999);
        }
        qb.andWhere('audit.createdAt <= :toDate', { toDate });
      }
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findForResource(resourceReference: string): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { resourceReference },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
    });
  }
}
