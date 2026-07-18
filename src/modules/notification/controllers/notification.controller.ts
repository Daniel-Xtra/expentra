import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { IResponse, successRequestResponse } from 'src/core/utils/helper';
import type { IAuthUser } from 'src/definition';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import { ListNotificationsQueryDto } from '../dtos/list-notifications.query.dto';
import { UpdateNotificationPreferencesDto } from '../dtos/update-notification-preferences.dto';
import { toNotificationPreferenceResponse } from '../mappers/notification-preference-response.mapper';
import { toNotificationResponse } from '../mappers/notification-response.mapper';
import { NotificationInboxService } from '../services/notification-inbox.service';

@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly inboxService: NotificationInboxService) {}

  @Get('preferences/me')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.NOTIFICATION)
  async getPreferences(@AuthUser() user: IAuthUser): Promise<IResponse> {
    const preferences = await this.inboxService.getPreferences(user.id);
    return successRequestResponse(
      'Notification preferences retrieved successfully',
      toNotificationPreferenceResponse(preferences),
    );
  }

  @Patch('preferences/me')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.NOTIFICATION)
  async updatePreferences(
    @AuthUser() user: IAuthUser,
    @Body() payload: UpdateNotificationPreferencesDto,
  ): Promise<IResponse> {
    const preferences = await this.inboxService.updatePreferences(
      user.id,
      payload,
    );
    return successRequestResponse(
      'Notification preferences updated successfully',
      toNotificationPreferenceResponse(preferences),
    );
  }

  @Get('')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.NOTIFICATION)
  async list(
    @AuthUser() user: IAuthUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<IResponse> {
    const result = await this.inboxService.listInApp(user, query);
    return successRequestResponse(
      'Notifications retrieved successfully',
      result.data.map(toNotificationResponse),
      result.meta,
    );
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.NOTIFICATION)
  async unreadCount(@AuthUser() user: IAuthUser): Promise<IResponse> {
    const count = await this.inboxService.getUnreadCount(user.id);
    return successRequestResponse('Unread notification count retrieved', { count });
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.MARK, PermissionResource.NOTIFICATION)
  async markAllRead(@AuthUser() user: IAuthUser): Promise<IResponse> {
    const count = await this.inboxService.markAllRead(user);
    return successRequestResponse('Notifications marked as read', { count });
  }

  @Post(':reference/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.MARK, PermissionResource.NOTIFICATION)
  async markRead(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ): Promise<IResponse> {
    const notification = await this.inboxService.markRead(user, reference);
    return successRequestResponse(
      'Notification marked as read',
      toNotificationResponse(notification),
    );
  }
}
