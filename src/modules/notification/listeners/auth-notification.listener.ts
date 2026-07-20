import { Injectable, Logger } from '@nestjs/common';
import { EmailContentBuilder } from '../builders/email-content.builder';
import { NotificationType } from 'src/database/entities/notification.enums';
import { NotificationDispatchService } from '../services/notification-dispatch.service';
import type {
  AuthEmailVerificationEvent,
  AuthPasswordResetEvent,
} from '../types/notification-events.types';

@Injectable()
export class AuthNotificationListener {
  private readonly logger = new Logger(AuthNotificationListener.name);

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    private readonly emailContent: EmailContentBuilder,
  ) {}

  async onEmailVerification(
    payload: AuthEmailVerificationEvent,
  ): Promise<void> {
    try {
      const content = this.emailContent.emailVerification(
        payload.email,
        payload.verifyToken,
        payload.firstName,
      );

      await this.dispatchService.scheduleEmail({
        userId: payload.userId,
        notificationType: NotificationType.EMAIL_VERIFICATION,
        to: payload.email,
        template: content.template,
        data: content.data,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to queue email verification: ${message}`);
    }
  }

  async onPasswordReset(payload: AuthPasswordResetEvent): Promise<void> {
    try {
      const content = this.emailContent.passwordReset(
        payload.email,
        payload.resetToken,
        payload.firstName,
      );

      await this.dispatchService.scheduleEmail({
        userId: payload.userId,
        notificationType: NotificationType.PASSWORD_RESET_REQUEST,
        to: payload.email,
        template: content.template,
        data: content.data,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to queue password reset email: ${message}`);
    }
  }
}
