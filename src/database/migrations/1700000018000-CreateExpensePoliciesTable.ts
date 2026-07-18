import { MigrationInterface, QueryRunner, Table } from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  REFERENCE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreateExpensePoliciesTable1700000018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'expense_policies',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'name', type: 'varchar', length: '128', isNullable: false },
          {
            name: 'rule_type',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'config', type: 'jsonb', isNullable: false },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('expense_policies', true, true, true);
  }
}
