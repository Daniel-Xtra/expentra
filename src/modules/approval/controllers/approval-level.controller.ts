import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import type { IAuthUser } from 'src/definition';
import { ExportService } from 'src/modules/export/services/export.service';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { exportQueuedResponse } from 'src/modules/export/utils/export-response.util';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { successRequestResponse } from 'src/core/utils/helper';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import {
  APPROVAL_LEVEL_SERVICE,
  type IApprovalLevelService,
} from '../contracts/approval-level.contract';
import { CreateApprovalLevelDto } from '../dtos/create-approval-level.dto';
import { ListApprovalLevelsQueryDto } from '../dtos/list-approval-levels.query.dto';
import { UpdateApprovalLevelDto } from '../dtos/update-approval-level.dto';
import { toApprovalLevelResponse } from '../mappers/approval-level-response.mapper';

@Controller({ path: 'approval-levels', version: '1' })
export class ApprovalLevelController {
  constructor(
    @Inject(APPROVAL_LEVEL_SERVICE)
    private readonly approvalLevelService: IApprovalLevelService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.APPROVAL_LEVEL)
  async create(@Body() payload: CreateApprovalLevelDto) {
    const approvalLevel = await this.approvalLevelService.create(payload);
    return successRequestResponse(
      'Approval level created successfully',
      toApprovalLevelResponse(approvalLevel),
    );
  }

  @Get(['', 'all'])
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.APPROVAL_LEVEL)
  async findAll(@Query() query: ListApprovalLevelsQueryDto) {
    const result = await this.approvalLevelService.findAllApprovalLevels(query);
    return successRequestResponse(
      'Approval levels fetched successfully',
      result.data.map(toApprovalLevelResponse),
      result.meta,
    );
  }

  @Get('workflow-health')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.APPROVAL_LEVEL)
  async workflowHealth() {
    const health = await this.approvalLevelService.getWorkflowHealth();
    return successRequestResponse('Approval workflow health fetched', health);
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionAction.READ, PermissionResource.APPROVAL_LEVEL)
  async exportCsv(
    @AuthUser() authUser: IAuthUser,
    @Query() query: ListApprovalLevelsQueryDto,
  ) {
    const result = await this.exportService.queueExport({
      authUser,
      jobType: ExportJobType.APPROVAL_LEVEL_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }

  @Get(':reference/impact')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.APPROVAL_LEVEL)
  async impact(@Param('reference', EntityReferencePipe) reference: string) {
    const summary = await this.approvalLevelService.getImpactSummary(reference);
    return successRequestResponse('Approval level impact fetched', summary);
  }

  @Patch(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.APPROVAL_LEVEL)
  async update(
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdateApprovalLevelDto,
  ) {
    const approvalLevel = await this.approvalLevelService.update(
      reference,
      payload,
    );
    return successRequestResponse(
      'Approval level updated successfully',
      toApprovalLevelResponse(approvalLevel),
    );
  }

  @Delete(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.APPROVAL_LEVEL)
  async remove(@Param('reference', EntityReferencePipe) reference: string) {
    await this.approvalLevelService.remove(reference);
    return successRequestResponse('Approval level deleted successfully');
  }
}
