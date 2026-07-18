import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SYSTEM_ROLES } from '../constants/system-roles';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';

function readConfigString(
  config: ConfigService,
  key: string,
  fallback?: string,
): string | undefined {
  const value: unknown = config.get(key, fallback);
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function resolveSuperAdminCredentials(config: ConfigService): {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
} | null {
  const email = readConfigString(config, 'SEED_SUPER_ADMIN_EMAIL');
  const firstName = readConfigString(
    config,
    'SEED_SUPER_ADMIN_FIRST_NAME',
  ) as string;
  const lastName = readConfigString(
    config,
    'SEED_SUPER_ADMIN_LAST_NAME',
  ) as string;
  const password = readConfigString(
    config,
    'SEED_SUPER_ADMIN_PASSWORD',
  ) as string;

  if (!email) {
    throw new Error('SEED_SUPER_ADMIN_EMAIL is not configured.');
  }

  if (!password) {
    console.warn(
      'SEED_SUPER_ADMIN_PASSWORD is required in production. Skipping super admin user seed.',
    );
    return null;
  }

  if (password.length < 8) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD must be at least 8 characters.');
  }

  return { email, password, firstName, lastName };
}

export async function seedSuperAdmin(
  dataSource: DataSource,
  config: ConfigService,
): Promise<void> {
  const credentials = resolveSuperAdminCredentials(config);
  if (!credentials) {
    return;
  }

  const superAdminRole: Role | null = await dataSource
    .getRepository(Role)
    .findOne({
      where: { name: SYSTEM_ROLES.SUPER_ADMIN },
    });
  if (!superAdminRole) {
    throw new Error(
      'super_admin role is missing. Run authorization seed first.',
    );
  }

  const userRepo = dataSource.getRepository(User);

  const existing = await userRepo.findOne({
    where: { email: credentials.email },
    select: { id: true },
  });

  if (existing) {
    console.log('Super admin user already exists; skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(credentials.password, 10);

  if (!superAdminRole.id) {
    throw new Error(
      'super_admin role is missing id. Re-run authorization seed.',
    );
  }

  const user = userRepo.create({
    email: credentials.email,
    password: passwordHash,
    firstName: credentials.firstName,
    lastName: credentials.lastName,
    isActive: true,
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    roleId: superAdminRole.id,
  });
  await userRepo.save(user);

  console.log('Super admin user created');
}
