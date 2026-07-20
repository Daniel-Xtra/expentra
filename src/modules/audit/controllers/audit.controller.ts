import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { successRequestResponse } from 'src/core/utils/helper';
import { RequirePermissionByName } from 'src/modules/authorization';
import { AUDIT_SERVICE, type IAuditService } from '../contracts/audit.contract';
import { ListAuditLogsQueryDto } from '../dtos/list-audit-logs.query.dto';
import { toAuditLogResponse } from '../mappers/audit-response.mapper';

@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @Get('')
  @HttpCode(HttpStatus.OK)
  @RequirePermissionByName('audit.read')
  async findAll(@Query() query: ListAuditLogsQueryDto) {
    const result = await this.auditService.findAll(query);
    return successRequestResponse(
      'Audit logs retrieved successfully',
      result.data.map(toAuditLogResponse),
      result.meta,
    );
  }

  @Get('resource/:reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermissionByName('audit.read')
  async findForResource(
    @Param('reference', EntityReferencePipe) reference: string,
  ) {
    const logs = await this.auditService.findForResource(reference);
    return successRequestResponse(
      'Resource audit trail retrieved successfully',
      logs.map(toAuditLogResponse),
    );
  }
}
