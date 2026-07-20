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
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreateExpenseApprovalsTable1700000014000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'expense_approvals',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'expense_id', type: 'integer', isNullable: false },
          { name: 'approval_level_id', type: 'integer', isNullable: false },
          { name: 'approver_id', type: 'integer', isNullable: false },
          {
            name: 'decision',
            type: 'varchar',
            default: "'PENDING'",
            isNullable: false,
          },
          { name: 'comment', type: 'text', isNullable: true },
          { name: 'decided_at', type: 'timestamptz', isNullable: false },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_expense_approvals_expense_level',
            columnNames: ['expense_id', 'approval_level_id'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('expense_approvals', [
      new TableForeignKey({
        name: 'FK_expense_approvals_expense_id',
        columnNames: ['expense_id'],
        referencedTableName: 'expenses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_expense_approvals_approval_level_id',
        columnNames: ['approval_level_id'],
        referencedTableName: 'approval_levels',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
      new TableForeignKey({
        name: 'FK_expense_approvals_approver_id',
        columnNames: ['approver_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('expense_approvals', true, true, true);
  }
}
