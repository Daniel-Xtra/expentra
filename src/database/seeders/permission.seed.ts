import { DataSource, In } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { ParentPermission } from '../entities/parent-permission.entity';
import { PermissionScope } from 'src/modules/authorization/constants/permissions';
import { seedParentPermissions } from './parent-permission.seeder';
import {
  PERMISSION_SEEDS,
  RETIRED_PERMISSION_NAMES,
} from './data/permissions.seed-data';

export async function seedPermissions(dataSource: DataSource): Promise<void> {
  await seedParentPermissions(dataSource);

  const parentRepo = dataSource.getRepository(ParentPermission);
  const permissionRepo = dataSource.getRepository(Permission);

  const parentNames = Array.from(
    new Set(PERMISSION_SEEDS.map((permission) => permission.parent)),
  );
  const parents = await parentRepo.find({ where: { name: In(parentNames) } });
  const parentByName = new Map(parents.map((parent) => [parent.name, parent]));

  if (parents.length !== parentNames.length) {
    const missing = parentNames.filter((name) => !parentByName.has(name));
    throw new Error(
      `Missing parent permissions: ${missing.join(', ')}. Run parent permission seed first.`,
    );
  }

  for (const seed of PERMISSION_SEEDS) {
    const parent = parentByName.get(seed.parent)!;
    const scope = seed.scope ?? PermissionScope.SELF;

    const existing = await permissionRepo.findOne({
      where: { resource: seed.resource, action: seed.action, scope },
    });

    const entity = existing
      ? Object.assign(existing, {
          name: seed.name,
          displayName: seed.displayName,
          description: seed.description ?? existing.description,
          isActive: seed.isActive ?? true,
          metadata: seed.metadata ?? existing.metadata,
          parentPermissionId: parent.id,
        })
      : permissionRepo.create({
          name: seed.name,
          displayName: seed.displayName,
          description: seed.description,
          resource: seed.resource,
          action: seed.action,
          scope,
          isActive: seed.isActive ?? true,
          metadata: seed.metadata ?? {},
          parentPermissionId: parent.id,
        });

    await permissionRepo.save(entity);
  }

  const activeNames = new Set(
    PERMISSION_SEEDS.map((permission) => permission.name),
  );
  const retiredNames = new Set<string>(RETIRED_PERMISSION_NAMES);
  const stale = await permissionRepo.find({
    where: { isActive: true },
  });

  for (const permission of stale) {
    if (
      !activeNames.has(permission.name) ||
      retiredNames.has(permission.name)
    ) {
      permission.isActive = false;
      await permissionRepo.save(permission);
    }
  }

  console.log('Permissions seed completed (parent_permissions, permissions).');
}
