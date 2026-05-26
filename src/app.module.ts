import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import type { RedisOptions } from 'ioredis';
import { CloudinaryModule } from './core/cloudinary/cloudinary.module';
import { RedisModule } from './core/redis/redis.module';
import { HealthModule } from './core/health/health.module';
import { RequestLoggingInterceptor } from './core/interceptors/request-logging.interceptor';
import { configValidationSchema } from './core/config/config.schema';

function redisOptionsFromUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  const port = url.port ? Number(url.port) : 6379;
  const db =
    url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;

  return {
    host: url.hostname,
    port,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(db !== undefined && !Number.isNaN(db) ? { db } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

@Module({
  imports: [
    // Strict environment validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    CloudinaryModule,

    // Database connection – async, using the real ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('POSTGRES_HOST'),
        port: config.get<number>('POSTGRES_PORT') ?? 5432,
        username: config.getOrThrow<string>('POSTGRES_USER'),
        password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
        database: config.getOrThrow<string>('POSTGRES_DB'),
        synchronize: false,
        autoLoadEntities: true,
        migrations: [__dirname + '/database/migrations/**/*.{js,ts}'],
        migrationsTableName: 'migrations',
        ssl: config.get<boolean>('POSTGRES_SSL')
          ? { rejectUnauthorized: false }
          : false,
        logging: config.get<boolean>('POSTGRES_LOGGING'),
      }),
    }),

    // In‑memory Event Emitter
    EventEmitterModule.forRoot({
      global: true,
      wildcard: false,
    }),

    // Redis Queue Connection (BullMQ)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): { connection: RedisOptions } => ({
        connection: redisOptionsFromUrl(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),

    // 5. Core System Modules
    HealthModule,
    RedisModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
