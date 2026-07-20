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

export class CreateExpenseAttachmentsTable1700000011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'expense_attachments',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'expense_id', type: 'integer', isNullable: false },
          { name: 'file_name', type: 'varchar', isNullable: false },
          { name: 'mime_type', type: 'varchar', isNullable: false },
          { name: 'size_bytes', type: 'integer', isNullable: false },
          {
            name: 'object_key',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '16',
            default: "'image'",
          },
          { name: 'uploaded_by_id', type: 'integer', isNullable: false },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('expense_attachments', [
      new TableForeignKey({
        name: 'FK_expense_attachments_expense_id',
        columnNames: ['expense_id'],
        referencedTableName: 'expenses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_expense_attachments_uploaded_by_id',
        columnNames: ['uploaded_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('expense_attachments', true, true, true);
  }
}
