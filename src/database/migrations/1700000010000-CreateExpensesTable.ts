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

export class CreateExpensesTable1700000010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'expenses',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'user_id', type: 'integer', isNullable: false },
          { name: 'department_id', type: 'integer', isNullable: true },
          { name: 'title', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'amount', type: 'bigint', isNullable: false },
          { name: 'currency', type: 'varchar', length: '3', default: "'NGN'" },
          {
            name: 'category',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          { name: 'status', type: 'varchar', default: "'DRAFT'", isNullable: false },
          { name: 'submitted_at', type: 'timestamptz', isNullable: true },
          { name: 'approved_at', type: 'timestamptz', isNullable: true },
          { name: 'rejected_at', type: 'timestamptz', isNullable: true },
          { name: 'reimbursed_at', type: 'timestamptz', isNullable: true },
          { name: 'incurred_at', type: 'timestamptz', isNullable: true },
          {
            name: 'reimbursement_reference',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('expenses', [
      new TableForeignKey({
        name: 'FK_expenses_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_expenses_department_id',
        columnNames: ['department_id'],
        referencedTableName: 'departments',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_user_id_status"
      ON "expenses" ("user_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_department_id_status"
      ON "expenses" ("department_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_expenses_status_submitted_at"
      ON "expenses" ("status", "submitted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_status_submitted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_department_id_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_expenses_user_id_status"`);
    await queryRunner.dropTable('expenses', true, true, true);
  }
}
