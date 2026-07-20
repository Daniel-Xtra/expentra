import { MigrationInterface, QueryRunner, Table } from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  REFERENCE_COLUMN,
  SOFT_DELETE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

/** manager_id FK is added after users (circular dependency). */
export class CreateDepartmentsTable1700000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'departments',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'name', type: 'varchar', isNullable: false },
          {
            name: 'code',
            type: 'varchar',
            length: '32',
            isNullable: false,
            isUnique: true,
          },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'manager_id', type: 'integer', isNullable: true },
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
    await queryRunner.dropTable('departments', true, true, true);
  }
}
