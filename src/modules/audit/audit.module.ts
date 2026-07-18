import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/database/entities/audit-log.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { AUDIT_SERVICE } from './contracts/audit.contract';
import { AuditController } from './controllers/audit.controller';
import { DomainAuditListener } from './listeners/domain-audit.listener';
import { AuditDomainEventRegistrar } from './registrars/audit-domain-event.registrar';
import { AuditService } from './services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Expense])],
  controllers: [AuditController],
  providers: [
    AuditService,
    DomainAuditListener,
    AuditDomainEventRegistrar,
    { provide: AUDIT_SERVICE, useExisting: AuditService },
  ],
  exports: [AuditService, AUDIT_SERVICE, DomainAuditListener],
})
export class AuditModule {}
