import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../data-source';
import { createSeedContext } from '../create-seed-config';
import { seedAuthorization } from './authorization.seed';
import { seedDefaultApprovalLevels } from './approval-level.seed';
import { seedPermissions } from './permission.seed';
import { seedParentPermissions } from './parent-permission.seeder';
import { seedSuperAdmin } from './super-admin.seed';

const LOG_FILE = path.join(process.cwd(), 'seeder_debug.log');

function createLogger(): (message: string) => void {
  fs.writeFileSync(
    LOG_FILE,
    `[${new Date().toISOString()}] Starting database seeding process...\n`,
  );

  return (message: string) => {
    console.log(message);
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
  };
}

function logConnectionDetails(log: (message: string) => void): void {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const database = process.env.POSTGRES_DB ?? '';
  const username = process.env.POSTGRES_USER ?? '';

  log('Database connection details:');
  log(`  Host: ${host}`);
  log(`  Port: ${port}`);
  log(`  Database: ${database}`);
  log(`  Username: ${username}`);
}

async function runSeeders(): Promise<void> {
  const log = createLogger();

  try {
    log('Starting database seeding process...');
    logConnectionDetails(log);

    const { dataSource, config } = await createSeedContext();
    log('Database connection initialized');

    log('Running pending migrations before seeding...');
    const appliedMigrations = await dataSource.runMigrations();
    log(
      appliedMigrations.length === 0
        ? 'No pending migrations.'
        : `Applied ${appliedMigrations.length} migration(s).`,
    );

    log('\n=== Running ParentPermissionSeeder ===');
    await seedParentPermissions(dataSource);
    log('=== ParentPermissionSeeder completed ===\n');

    log('\n=== Running PermissionSeeder ===');
    await seedPermissions(dataSource);
    log('=== PermissionSeeder completed ===\n');

    log('\n=== Running AuthorizationSeeder ===');
    await seedAuthorization(dataSource);
    log('=== AuthorizationSeeder completed ===\n');

    log('\n=== Running ApprovalLevelSeeder ===');
    await seedDefaultApprovalLevels(dataSource);
    log('=== ApprovalLevelSeeder completed ===\n');

    log('\n=== Running SuperAdminSeeder ===');
    await seedSuperAdmin(dataSource, config);
    log('=== SuperAdminSeeder completed ===\n');

    log('All seeders completed successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Seeding failed: ${message}`);
    if (error instanceof Error && error.stack) {
      log(error.stack);
    }
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      log('Database connection closed');
    }
  }
}

runSeeders().catch(() => {
  process.exit(1);
});
