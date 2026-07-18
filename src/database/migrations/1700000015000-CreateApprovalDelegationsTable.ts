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

export class CreateApprovalDelegationsTable1700000015000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'approval_delegations',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'delegator_id', type: 'integer', isNullable: false },
          { name: 'delegate_id', type: 'integer', isNullable: false },
          { name: 'starts_at', type: 'timestamptz', isNullable: false },
          { name: 'ends_at', type: 'timestamptz', isNullable: false },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('approval_delegations', [
      new TableForeignKey({
        name: 'FK_approval_delegations_delegator_id',
        columnNames: ['delegator_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_approval_delegations_delegate_id',
        columnNames: ['delegate_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.query(`
      CREATE INDEX "IDX_approval_delegations_delegate_active"
      ON "approval_delegations" ("delegate_id", "is_active", "starts_at", "ends_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_approval_delegations_delegate_active"`,
    );
    await queryRunner.dropTable('approval_delegations', true, true, true);
  }
}
