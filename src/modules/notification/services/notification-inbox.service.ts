import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { Notification } from 'src/database/entities/notification.entity';
import {
  NotificationChannel,
  NotificationStatus,
} from 'src/database/entities/notification.enums';
import { NotificationPreference } from 'src/database/entities/notification-preference.entity';
import type { IAuthUser } from 'src/definition';

export type ListNotificationsQuery = {
  unreadOnly?: boolean;
  readOnly?: boolean;
  page?: number;
  limit?: number;
};

export type UpdateNotificationPreferencesInput = {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  typePreferences?: Record<string, { email?: boolean; inApp?: boolean }>;
};

@Injectable()
export class NotificationInboxService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
  ) {}

  async listInApp(authUser: IAuthUser, query: ListNotificationsQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId: authUser.id })
      .andWhere('notification.channel = :channel', {
        channel: NotificationChannel.IN_APP,
      })
      .orderBy('notification.created_at', 'DESC');

    if (query.unreadOnly && query.readOnly) {
      throw new BadRequestException(
        'Cannot filter unread and read notifications at the same time',
      );
    }

    if (query.unreadOnly) {
      qb.andWhere('notification.read_at IS NULL');
    } else if (query.readOnly) {
      qb.andWhere('notification.read_at IS NOT NULL');
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        unreadCount: await this.countUnread(authUser.id),
      },
    };
  }

  async markRead(
    authUser: IAuthUser,
    reference: string,
  ): Promise<Notification> {
    const notification = await findEntityByReference(
      this.notificationRepository,
      reference,
      'Notification not found',
    );

    if (notification.userId !== authUser.id) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }

    return notification;
  }

  async markAllRead(authUser: IAuthUser): Promise<number> {
    const result = await this.notificationRepository.update(
      {
        userId: authUser.id,
        channel: NotificationChannel.IN_APP,
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  async getPreferences(userId: number): Promise<NotificationPreference> {
    const existing = await this.preferenceRepository.findOne({
      where: { userId },
    });
    if (existing) {
      return existing;
    }

    return this.preferenceRepository.save(
      this.preferenceRepository.create({ userId }),
    );
  }

  async updatePreferences(
    userId: number,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreference> {
    const preferences = await this.getPreferences(userId);

    if (input.emailEnabled !== undefined) {
      preferences.emailEnabled = input.emailEnabled;
    }
    if (input.inAppEnabled !== undefined) {
      preferences.inAppEnabled = input.inAppEnabled;
    }
    if (input.typePreferences !== undefined) {
      preferences.typePreferences = {
        ...(preferences.typePreferences ?? {}),
        ...input.typePreferences,
      };
    }

    return this.preferenceRepository.save(preferences);
  }

  async isChannelEnabled(
    userId: number,
    channel: 'email' | 'inApp',
    notificationType: string,
  ): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    const globalEnabled =
      channel === 'email' ? preferences.emailEnabled : preferences.inAppEnabled;
    if (!globalEnabled) {
      return false;
    }

    const typePref = preferences.typePreferences?.[notificationType];
    if (!typePref) {
      return true;
    }

    return channel === 'email'
      ? typePref.email !== false
      : typePref.inApp !== false;
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.countUnread(userId);
  }

  private async countUnread(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        readAt: IsNull(),
      },
    });
  }
}
