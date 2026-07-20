import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { successRequestResponse } from 'src/core/utils/helper';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import { CreatePolicyRuleTemplateDto } from '../dtos/create-policy-rule-template.dto';
import { CreatePolicyConditionFieldDto } from '../dtos/create-policy-condition-field.dto';
import { UpdatePolicyConditionFieldDto } from '../dtos/update-policy-condition-field.dto';
import { UpdatePolicyRuleTemplateDto } from '../dtos/update-policy-rule-template.dto';
import { PolicyCatalogService } from '../services/policy-catalog.service';

@Controller({ path: 'policies/catalog', version: '1' })
export class PolicyCatalogController {
  constructor(private readonly catalogService: PolicyCatalogService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.POLICY)
  async getCatalog() {
    const catalog = await this.catalogService.getCatalog();
    return successRequestResponse(
      'Policy catalog retrieved successfully',
      catalog,
    );
  }

  @Get('fields/all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.POLICY)
  async listFields() {
    const fields = await this.catalogService.listAllFields();
    return successRequestResponse(
      'Policy condition fields retrieved successfully',
      fields,
    );
  }

  @Post('fields')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.POLICY)
  async createField(@Body() payload: CreatePolicyConditionFieldDto) {
    const field = await this.catalogService.createField(payload);
    return successRequestResponse(
      'Policy condition field created successfully',
      field,
    );
  }

  @Patch('fields/:reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.POLICY)
  async updateField(
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdatePolicyConditionFieldDto,
  ) {
    const field = await this.catalogService.updateField(reference, payload);
    return successRequestResponse(
      'Policy condition field updated successfully',
      field,
    );
  }

  @Delete('fields/:reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.POLICY)
  async removeField(
    @Param('reference', EntityReferencePipe) reference: string,
  ) {
    await this.catalogService.removeField(reference);
    return successRequestResponse(
      'Policy condition field deleted successfully',
    );
  }

  @Get('templates/all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.POLICY)
  async listTemplates() {
    const templates = await this.catalogService.listAllTemplates();
    return successRequestResponse(
      'Policy rule templates retrieved successfully',
      templates,
    );
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.POLICY)
  async createTemplate(@Body() payload: CreatePolicyRuleTemplateDto) {
    const template = await this.catalogService.createTemplate(payload);
    return successRequestResponse(
      'Policy rule template created successfully',
      template,
    );
  }

  @Patch('templates/:reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.POLICY)
  async updateTemplate(
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdatePolicyRuleTemplateDto,
  ) {
    const template = await this.catalogService.updateTemplate(
      reference,
      payload,
    );
    return successRequestResponse(
      'Policy rule template updated successfully',
      template,
    );
  }

  @Delete('templates/:reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.POLICY)
  async removeTemplate(
    @Param('reference', EntityReferencePipe) reference: string,
  ) {
    await this.catalogService.removeTemplate(reference);
    return successRequestResponse('Policy rule template deleted successfully');
  }
}
