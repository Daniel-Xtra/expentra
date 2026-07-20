import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import AppDataSource from './database/data-source';
import { configValidationSchema } from './core/config/config.schema';
import { redisOptionsFromUrl } from './core/config/redis-bull.util';
import { CorrelationModule } from './core/correlation/correlation.module';
import { OutboxModule } from './core/outbox/outbox.module';
import { RedisModule } from './core/redis/redis.module';
import { RateLimiterModule } from './core/rate-limiter/rate-limiter.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { UserModule } from './modules/user/user.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DepartmentModule } from './modules/department/department.module';
import { BudgetModule } from './modules/budget/budget.module';
import { ExportModule } from './modules/export/export.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { ReportModule } from './modules/report/report.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { WorkerProcessorsModule } from './queues/worker-processors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    CorrelationModule,
    TypeOrmModule.forRoot(AppDataSource.options),
    OutboxModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisOptionsFromUrl(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    RedisModule,
    RateLimiterModule,
    AuthorizationModule,
    UserModule,
    NotificationModule,
    DepartmentModule,
    BudgetModule,
    ExportModule,
    ExpenseModule,
    ApprovalModule,
    ReportModule,
    AuditModule,
    DashboardModule,
    WorkerProcessorsModule,
  ],
})
export class WorkerModule {}
