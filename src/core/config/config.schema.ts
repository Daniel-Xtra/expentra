import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // App Configuration
  PORT: Joi.number().required(),

  // Redis Configuration
  REDIS_URL: Joi.string().required(),
  REDIS_DISABLE_SSL: Joi.boolean().required(),

  // PostgreSQL Configuration
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_LOGGING: Joi.boolean().required(),
  POSTGRES_SSL: Joi.boolean().required(),

  // Security & JWT Configuration
  ALLOWED_ORIGINS: Joi.string().required(),

  // Cloudinary (receipts and other uploads)
  CLOUDINARY_CLOUD_NAME: Joi.string().min(1).required(),
  CLOUDINARY_API_KEY: Joi.string().min(1).required(),
  CLOUDINARY_API_SECRET: Joi.string().min(1).required(),
  CLOUDINARY_RECEIPT_FOLDER: Joi.string().default('expentra/receipts'),

  // Logging
  LOG_HTTP_REQUESTS: Joi.boolean().default(true),

  // External notification HTTP API (optional — omit in dev to log only)
  NOTIFICATION_SERVICE_URL: Joi.string().uri().optional().allow(''),
  NOTIFICATION_CLIENT_ID: Joi.string()
    .optional()
    .allow('')
    .when('NOTIFICATION_SERVICE_URL', {
      is: Joi.string().min(1).required(),
      then: Joi.string().min(1).required(),
    }),

  // Docker entrypoint (`scripts/docker-entrypoint.sh`)
  RUN_MIGRATIONS: Joi.boolean().required(),
  RUN_SEED: Joi.boolean().required(),
  USE_COMPILED_DB: Joi.boolean().required(),
}).unknown(true);
