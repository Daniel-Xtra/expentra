import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  REFERENCE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreateApprovalLevelsTable1700000013000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'approval_levels',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'role_id', type: 'integer', isNullable: true },
          {
            name: 'approver_type',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          { name: 'name', type: 'varchar', length: '128', isNullable: false },
          { name: 'level', type: 'smallint', isUnique: true },
          { name: 'minimum_amount', type: 'bigint', isNullable: false },
          { name: 'maximum_amount', type: 'bigint', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'approval_levels',
      new TableForeignKey({
        name: 'FK_approval_levels_role_id',
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('approval_levels', true, true, true);
  }
}
