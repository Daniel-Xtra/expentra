import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { configValidationSchema } from '../core/config/config.schema';
import AppDataSource from './data-source';

/** Minimal ConfigService backed by Joi-validated env (same rules as the Nest app). */
class SeedEnvConfig implements Pick<ConfigService, 'get'> {
  constructor(private readonly env: Record<string, unknown>) {}

  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.env[key];
    return (value !== undefined && value !== '' ? value : defaultValue) as
      | T
      | undefined;
  }
}

export type SeedContext = {
  dataSource: DataSource;
  config: ConfigService;
};

function isPlainEnvRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSeedEnv(): Record<string, unknown> {
  const result = configValidationSchema.validate(process.env, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (result.error) {
    throw new Error(`Seed config validation failed: ${result.error.message}`);
  }

  if (!isPlainEnvRecord(result.value)) {
    throw new Error('Seed config validation failed: empty configuration');
  }

  return result.value;
}

/**
 * Validates env (Joi), initializes `AppDataSource`, and returns both for seed scripts.
 * `data-source.ts` loads dotenv and defines the DB connection used here and by migrations.
 */
export async function createSeedContext(
  options: { logging?: boolean } = {},
): Promise<SeedContext> {
  const config = new SeedEnvConfig(
    validateSeedEnv(),
  ) as unknown as ConfigService;

  if (!AppDataSource.isInitialized) {
    AppDataSource.setOptions({
      ...AppDataSource.options,
      logging: options.logging ?? false,
    });
    await AppDataSource.initialize();
  }

  return { dataSource: AppDataSource, config };
}
