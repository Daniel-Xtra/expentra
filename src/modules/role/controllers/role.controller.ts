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
  Put,
  Query,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import type { IAuthUser } from 'src/definition';
import { successRequestResponse } from 'src/core/utils/helper';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import { ROLE_SERVICE, type IRoleService } from '../contracts/role.contract';
import { ApplyRoleTemplateDto } from '../dtos/apply-role-template.dto';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { ListRolesQueryDto } from '../dtos/list-roles.query.dto';
import { SetRolePermissionsDto } from '../dtos/set-role-permissions.dto';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { groupPermissionsByParent } from '../mappers/permission-response.mapper';
import { toRoleResponse } from '../mappers/role-response.mapper';

@Controller({ path: 'roles', version: '1' })
export class RoleController {
  constructor(
    @Inject(ROLE_SERVICE) private readonly roleService: IRoleService,
  ) {}

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.ROLE)
  async permissions() {
    const permissions = await this.roleService.findAllPermissions();
    return successRequestResponse(
      'Permissions fetched successfully',
      groupPermissionsByParent(permissions),
    );
  }

  @Get('templates')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.ROLE)
  async templates() {
    const items = await this.roleService.findTemplates();
    return successRequestResponse('Role templates fetched successfully', items);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.ROLE)
  async create(@AuthUser() actor: IAuthUser, @Body() payload: CreateRoleDto) {
    const role = await this.roleService.create(actor, payload);
    return successRequestResponse(
      'Role created successfully',
      toRoleResponse(role),
    );
  }

  @Get(['', 'all'])
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.ROLE)
  async findAll(@Query() query: ListRolesQueryDto) {
    const result = await this.roleService.findAllRoles(query);
    return successRequestResponse(
      'Roles fetched successfully',
      result.data.map((role) => toRoleResponse(role)),
      result.meta,
    );
  }

  @Get(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.ROLE)
  async findOne(@Param('reference', EntityReferencePipe) reference: string) {
    const role = await this.roleService.findOne(reference);
    return successRequestResponse(
      'Role fetched successfully',
      toRoleResponse(role, { includePermissions: true }),
    );
  }

  @Patch(':reference/apply-template')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.ROLE)
  async applyTemplate(
    @AuthUser() actor: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: ApplyRoleTemplateDto,
  ) {
    const role = await this.roleService.applyTemplate(
      actor,
      reference,
      payload.templateKey,
    );
    return successRequestResponse(
      'Role template applied successfully',
      toRoleResponse(role, { includePermissions: true }),
    );
  }

  @Patch(':reference/permissions')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.ROLE)
  async setPermissions(
    @AuthUser() actor: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: SetRolePermissionsDto,
  ) {
    const role = await this.roleService.setPermissions(
      actor,
      reference,
      payload,
    );
    return successRequestResponse(
      'Role permissions updated successfully',
      toRoleResponse(role, { includePermissions: true }),
    );
  }

  @Patch(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.ROLE)
  async update(
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdateRoleDto,
  ) {
    const role = await this.roleService.update(reference, payload);
    return successRequestResponse(
      'Role updated successfully',
      toRoleResponse(role),
    );
  }

  @Delete(':reference')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.ROLE)
  async remove(@Param('reference', EntityReferencePipe) reference: string) {
    await this.roleService.remove(reference);
  }
}
