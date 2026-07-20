import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSource from './database/data-source';
import { OutboxModule } from './core/outbox/outbox.module';
import { IdempotencyModule } from './core/idempotency/idempotency.module';
import { BullModule } from '@nestjs/bullmq';
import { CloudinaryModule } from './core/cloudinary/cloudinary.module';
import { RedisModule } from './core/redis/redis.module';
import { HealthModule } from './core/health/health.module';
import { MetricsModule } from './core/metrics/metrics.module';
import { MetricsInterceptor } from './core/metrics/metrics.interceptor';
import { CoreHttpModule } from './core/core-http.module';
import { CorrelationModule } from './core/correlation/correlation.module';
import { RequestLoggingInterceptor } from './core/interceptors/request-logging.interceptor';
import { configValidationSchema } from './core/config/config.schema';
import { redisOptionsFromUrl } from './core/config/redis-bull.util';
import { RateLimitGuard } from './core/rate-limiter/guards/rate-limit.guard';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { AccountStatusGuard } from './core/guards/account-status.guard';
import { AccessGuard } from './modules/authorization/guards/access.guard';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { RateLimiterModule } from './core/rate-limiter/rate-limiter.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoleModule } from './modules/role/role.module';
import { DepartmentModule } from './modules/department/department.module';
import { BudgetModule } from './modules/budget/budget.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { ReportModule } from './modules/report/report.module';
import { PolicyModule } from './modules/policy/policy.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExportModule } from './modules/export/export.module';

@Module({
  imports: [
    // Strict environment validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    CloudinaryModule,
    CorrelationModule,

    // Database connection – using shared DataSource configuration
    TypeOrmModule.forRoot(AppDataSource.options),

    OutboxModule,
    IdempotencyModule,

    // Redis Queue Connection (BullMQ)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisOptionsFromUrl(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),

    // 5. Core System Modules
    CoreHttpModule,
    HealthModule,
    MetricsModule,
    RedisModule,
    AuthorizationModule,
    RateLimiterModule,
    UserModule,
    AuthModule,
    NotificationModule,
    RoleModule,
    DepartmentModule,
    BudgetModule,
    ExpenseModule,
    ReceiptModule,
    ApprovalModule,
    ReportModule,
    PolicyModule,
    AuditModule,
    DashboardModule,
    ExportModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccountStatusGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
