import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // App Configuration
  PORT: Joi.number().required(),

  // Redis Configuration
  REDIS_URL: Joi.string().required(),
  REDIS_DISABLE_SSL: Joi.boolean().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),

  // PostgreSQL Configuration
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_LOGGING: Joi.boolean().required(),
  POSTGRES_SSL: Joi.boolean().required(),

  // Security & JWT Configuration
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.optional().allow(''),
  }),
  JWT_EXPIRES_IN: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().default('15m'),
    otherwise: Joi.string().default('1d'),
  }),
  JWT_REFRESH_EXPIRES: Joi.string().required(),
  ALLOW_PUBLIC_REGISTRATION: Joi.boolean().required(),
  ALLOWED_ORIGINS: Joi.string().required(),
  ALLOW_DEV_OPAQUE_TOKEN: Joi.boolean().default(false),
  TRUST_PROXY: Joi.boolean().default(false),
  RATE_LIMIT_GLOBAL_LIMIT: Joi.number().integer().min(1).default(300),
  RATE_LIMIT_GLOBAL_TTL: Joi.number().integer().min(1).default(60),
  AUTH_CONTEXT_CACHE_TTL_SECONDS: Joi.number().integer().min(0).default(60),
  SWAGGER_ENABLED: Joi.boolean().default(false),
  POSTGRES_SSL_REJECT_UNAUTHORIZED: Joi.boolean().default(true),
  POSTGRES_SSL_CA: Joi.string().optional().allow(''),
  REDIS_TLS_REJECT_UNAUTHORIZED: Joi.boolean().default(true),
  REDIS_TLS_CA: Joi.string().optional().allow(''),
  QUEUE_DASHBOARD_ENABLED: Joi.boolean().default(false),
  QUEUE_DASHBOARD_USERNAME: Joi.string().optional().allow(''),
  QUEUE_DASHBOARD_PASSWORD: Joi.string().optional().allow(''),

  // Frontend base URL for links in notification emails
  APP_URL: Joi.string().uri().required(),

  // Cloudinary (receipts and other uploads)
  CLOUDINARY_CLOUD_NAME: Joi.string().min(1).required(),
  CLOUDINARY_API_KEY: Joi.string().min(1).required(),
  CLOUDINARY_API_SECRET: Joi.string().min(1).required(),
  CLOUDINARY_RECEIPT_FOLDER: Joi.string().required(),

  // Delay before escalation reminder job (hours)
  APPROVAL_ESCALATION_DELAY_HOURS: Joi.number().integer().min(1).required(),

  // Department annual budgets (alert-only by default; set true to block overspend submits)
  BUDGET_TIMEZONE: Joi.string().required(),
  BUDGET_BLOCK_SUBMIT_ON_OVERSPEND: Joi.boolean().default(false),
  BUDGET_ALERT_THRESHOLD_PERCENT: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .required(),
  BUDGET_ALERT_THRESHOLDS: Joi.string().default('75,90,100'),

  // Logging
  LOG_HTTP_REQUESTS: Joi.boolean().required(),

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

  // Super admin seeder (`npm run seed:run`) — only `super_admin` role is seeded
  SEED_SUPER_ADMIN_EMAIL: Joi.string().email().required(),
  SEED_SUPER_ADMIN_PASSWORD: Joi.string().min(8).optional().allow(''),
  SEED_SUPER_ADMIN_FIRST_NAME: Joi.string().required(),
  SEED_SUPER_ADMIN_LAST_NAME: Joi.string().required(),

  // OIDC SSO (optional — enable when IdP is ready)
  SSO_ENABLED: Joi.boolean().default(false),
  SSO_ISSUER_URL: Joi.string()
    .uri()
    .when('SSO_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
  SSO_CLIENT_ID: Joi.string().when('SSO_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.optional().allow(''),
  }),
  SSO_CLIENT_SECRET: Joi.string().when('SSO_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.optional().allow(''),
  }),
  SSO_REDIRECT_URI: Joi.string()
    .uri()
    .when('SSO_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
  SSO_SCOPES: Joi.string().default('openid profile email'),
  SSO_AUTO_PROVISION: Joi.boolean().default(false),
  SSO_ALLOWED_EMAIL_DOMAINS: Joi.string().optional().allow(''),
  SSO_BUTTON_LABEL: Joi.string().optional().allow(''),
}).unknown(true);
