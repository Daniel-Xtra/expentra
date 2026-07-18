import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  VersioningType,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
// Cloudinary client is now configured via CloudinaryModule
import { createSecurityConfig } from './core/config/security.config';
import { createValidationConfig } from './core/config/validation.config';
import { HttpErrorFilter } from './core/exceptions/http-exception-filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { TrimPipe } from './core/pipes/trim.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 1. Global Versioning and prefix
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 2. Middleware & Security
  app.use(createSecurityConfig());
  const parseCookies = cookieParser as () => RequestHandler;
  app.use(parseCookies());

  // 3. CORS Configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With',
    credentials: true,
    maxAge: 86400, // 1 day
  });

  // 4. Global Filters & Pipes
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalPipes(new TrimPipe(), createValidationConfig());

  // 5. Global Interceptors
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // 6. Graceful Shutdown
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  Logger.log(`Expentra API is running on: http://localhost:${port}`);
}
void bootstrap();
