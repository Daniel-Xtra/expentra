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

export class CreateExpenseCommentsTable1700000012000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'expense_comments',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'expense_id', type: 'integer', isNullable: false },
          { name: 'user_id', type: 'integer', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('expense_comments', [
      new TableForeignKey({
        name: 'FK_expense_comments_expense_id',
        columnNames: ['expense_id'],
        referencedTableName: 'expenses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_expense_comments_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.query(`
      CREATE INDEX "IDX_expense_comments_expense_id"
      ON "expense_comments" ("expense_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_expense_comments_expense_id"`,
    );
    await queryRunner.dropTable('expense_comments', true, true, true);
  }
}
