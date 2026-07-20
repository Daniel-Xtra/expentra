import { Logger, type INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

type SwaggerBuilder = {
  setTitle(title: string): SwaggerBuilder;
  setDescription(description: string): SwaggerBuilder;
  setVersion(version: string): SwaggerBuilder;
  addBearerAuth(options: Record<string, unknown>, name: string): SwaggerBuilder;
  build(): object;
};

type SwaggerModuleType = {
  DocumentBuilder: new () => SwaggerBuilder;
  SwaggerModule: {
    createDocument(app: INestApplication, config: object): object;
    setup(
      path: string,
      app: INestApplication,
      document: object,
      options?: Record<string, unknown>,
    ): void;
  };
};

function loadSwaggerModule(): SwaggerModuleType | null {
  try {
    return require('@nestjs/swagger') as SwaggerModuleType;
  } catch {
    return null;
  }
}

export function setupSwagger(
  app: INestApplication,
  configService?: ConfigService,
): void {
  const enabled =
    configService?.get<boolean>('SWAGGER_ENABLED', false) ??
    process.env.SWAGGER_ENABLED === 'true';

  if (!enabled) {
    return;
  }

  const swagger = loadSwaggerModule();
  if (!swagger) {
    Logger.warn(
      'SWAGGER_ENABLED=true but @nestjs/swagger is not installed. Run: npm install @nestjs/swagger',
      'Swagger',
    );
    return;
  }

  const config = new swagger.DocumentBuilder()
    .setTitle('Expentra API')
    .setDescription('Internal expense management platform API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = swagger.SwaggerModule.createDocument(app, config);
  swagger.SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
  Logger.log('OpenAPI docs available at /api/docs', 'Swagger');
}
