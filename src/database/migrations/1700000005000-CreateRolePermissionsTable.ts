import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateRolePermissionsTable1700000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'role_permissions',
        columns: [
          { name: 'role_id', type: 'integer', isPrimary: true },
          { name: 'permission_id', type: 'integer', isPrimary: true },
        ],
        foreignKeys: [
          {
            name: 'FK_role_permissions_role_id',
            columnNames: ['role_id'],
            referencedTableName: 'roles',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_role_permissions_permission_id',
            columnNames: ['permission_id'],
            referencedTableName: 'permissions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('role_permissions', true, true, true);
  }
}
