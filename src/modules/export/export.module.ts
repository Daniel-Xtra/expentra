import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RateLimiterModule } from 'src/core/rate-limiter/rate-limiter.module';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { UserModule } from 'src/modules/user/user.module';
import { EXPORT_QUEUE } from './constants/export-queue.constants';
import { ExportGenerationService } from './services/export-generation.service';
import { ExportJobHandlerRegistry } from './services/export-job-handler.registry';
import { ExportService } from './services/export.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: EXPORT_QUEUE }),
    RateLimiterModule,
    forwardRef(() => NotificationModule),
    forwardRef(() => UserModule),
  ],
  providers: [ExportJobHandlerRegistry, ExportService, ExportGenerationService],
  exports: [ExportService, ExportJobHandlerRegistry, ExportGenerationService],
})
export class ExportModule {}
