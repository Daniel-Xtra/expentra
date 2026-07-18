import { DataSource } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { resolveRolePermissions } from './data/role-permissions.seed-data';
import { ROLE_DEFINITIONS } from './data/roles.seed-data';

/**
 * Seeds system roles and assigns permissions.
 * Run after parent permissions and permissions are seeded.
 */
export async function seedAuthorization(dataSource: DataSource): Promise<void> {
  const roleRepo = dataSource.getRepository(Role);
  const allPermissions = await dataSource.getRepository(Permission).find({
    where: { isActive: true },
  });

  for (const definition of ROLE_DEFINITIONS) {
    const permissions = resolveRolePermissions(definition.name, allPermissions);

    let role = await roleRepo.findOne({
      where: { name: definition.name },
      relations: { permissions: true },
    });

    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({
          name: definition.name,
          description: definition.description,
        }),
      );
    } else if (role.description !== definition.description) {
      role.description = definition.description;
      await roleRepo.save(role);
    }

    const existingPermissions = role.permissions ?? [];
    await roleRepo
      .createQueryBuilder()
      .relation(Role, 'permissions')
      .of(role)
      .addAndRemove(permissions, existingPermissions);

    console.log(
      `Role "${definition.name}" saved with ${permissions.length} permission(s).`,
    );
  }
}
