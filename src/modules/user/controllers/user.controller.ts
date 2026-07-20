import {
  Body,
  Controller,
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
import { AllowAuthenticated } from 'src/core/decorators/allow-authenticated.decorator';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import type { IAuthUser } from 'src/definition';
import { RequirePermissionByName } from 'src/modules/authorization';
import { successRequestResponse } from 'src/core/utils/helper';
import { USER_SERVICE, type IUserService } from '../contracts/user.contract';
import { AdminUpdateUserDto } from '../dtos/admin-update-user.dto';
import { ListUsersQueryDto } from '../dtos/list-users.query.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { ExportService } from 'src/modules/export/services/export.service';
import { ExportJobType } from 'src/modules/export/types/export.types';
import { exportQueuedResponse } from 'src/modules/export/utils/export-response.util';
import { toUserResponse } from '../mappers/user-response.mapper';

@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    private readonly exportService: ExportService,
  ) {}

  @Get('me')
  @AllowAuthenticated()
  @HttpCode(HttpStatus.OK)
  async getMe(@AuthUser() authUser: IAuthUser) {
    const user = await this.userService.getProfile(authUser.id);
    const isDepartmentManager = await this.userService.isUserDepartmentManager(
      user.id,
    );
    return successRequestResponse(
      'Profile fetched successfully',
      toUserResponse(user, { isDepartmentManager }),
    );
  }

  @Patch('me')
  @AllowAuthenticated()
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @AuthUser() authUser: IAuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.userService.updateProfile(authUser.id, dto);
    const isDepartmentManager = await this.userService.isUserDepartmentManager(
      user.id,
    );
    return successRequestResponse(
      'Profile updated successfully',
      toUserResponse(user, { isDepartmentManager }),
    );
  }

  @Patch('me/password')
  @AllowAuthenticated()
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @AuthUser() authUser: IAuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(authUser.id, dto);
    return successRequestResponse('Password updated successfully');
  }

  @Get('')
  @HttpCode(HttpStatus.OK)
  @RequirePermissionByName('user.read')
  async findAll(@Query() query: ListUsersQueryDto) {
    const result = await this.userService.findAllUsers(query);
    const managerIds = await this.userService.findDepartmentManagerUserIds(
      result.data.map((user) => user.id),
    );
    const users = result.data.map((user) =>
      toUserResponse(user, {
        isDepartmentManager: managerIds.has(user.id),
      }),
    );
    return successRequestResponse(
      'Users fetched successfully',
      users,
      result.meta,
    );
  }

  @Get('status-counts')
  @HttpCode(HttpStatus.OK)
  @RequirePermissionByName('user.read')
  async statusCounts() {
    const counts = await this.userService.getUserStatusCounts();
    return successRequestResponse('User status counts fetched', counts);
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissionByName('user.read')
  async exportCsv(
    @AuthUser() authUser: IAuthUser,
    @Query() query: ListUsersQueryDto,
  ) {
    const result = await this.exportService.queueExport({
      authUser,
      jobType: ExportJobType.USER_XLSX,
      params: query,
    });
    return exportQueuedResponse(result);
  }

  @Get(':reference/summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermissionByName('user.read')
  async getSummary(@Param('reference', EntityReferencePipe) reference: string) {
    const summary = await this.userService.getUserDetailSummary(reference);
    return successRequestResponse('User summary fetched successfully', summary);
  }

  @Patch(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermissionByName('user.update')
  async adminUpdate(
    @AuthUser() authUser: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    const target = await this.userService.findOneByReference(reference);
    const user = await this.userService.adminUpdate(authUser, target.id, dto);
    const isDepartmentManager = await this.userService.isUserDepartmentManager(
      user.id,
    );
    return successRequestResponse(
      'User updated successfully',
      toUserResponse(user, { isDepartmentManager }),
    );
  }
}
