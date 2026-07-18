import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  REFERENCE_COLUMN,
  SOFT_DELETE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreatePermissionsTable1700000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'display_name', type: 'varchar', default: "''" },
          { name: 'resource', type: 'varchar', isNullable: false },
          { name: 'action', type: 'varchar', isNullable: false },
          {
            name: 'scope',
            type: 'varchar',
            default: "'global'",
          },
          { name: 'conditions', type: 'jsonb', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'parent_permission_id', type: 'integer', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
          SOFT_DELETE_COLUMN,
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_permissions_resource_action_scope',
            columnNames: ['resource', 'action', 'scope'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'permissions',
      new TableForeignKey({
        name: 'FK_permissions_parent_permission_id',
        columnNames: ['parent_permission_id'],
        referencedTableName: 'parent_permissions',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permissions', true, true, true);
  }
}
