import { MigrationInterface, QueryRunner, Table } from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  REFERENCE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreatePolicyCatalogTables1700000021000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'policy_condition_fields',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          {
            name: 'key',
            type: 'varchar',
            length: '64',
            isNullable: false,
            isUnique: true,
          },
          { name: 'label', type: 'varchar', length: '128', isNullable: false },
          { name: 'description', type: 'text', isNullable: false },
          {
            name: 'value_type',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          { name: 'operators', type: 'jsonb', isNullable: false },
          { name: 'param_definitions', type: 'jsonb', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'sort_order', type: 'integer', default: 0 },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'policy_rule_templates',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'name', type: 'varchar', length: '128', isNullable: false },
          { name: 'description', type: 'text', isNullable: false },
          { name: 'match', type: 'varchar', length: '8', isNullable: false },
          { name: 'conditions', type: 'jsonb', isNullable: false },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'sort_order', type: 'integer', default: 0 },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('policy_rule_templates', true, true, true);
    await queryRunner.dropTable('policy_condition_fields', true, true, true);
  }
}
