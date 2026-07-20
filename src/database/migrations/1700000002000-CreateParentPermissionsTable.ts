import { MigrationInterface, QueryRunner, Table } from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  REFERENCE_COLUMN,
  SOFT_DELETE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreateParentPermissionsTable1700000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'parent_permissions',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'display_name', type: 'varchar', isNullable: false },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
          SOFT_DELETE_COLUMN,
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('parent_permissions', true, true, true);
  }
}
