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

export class CreateNotificationsTable1700000016000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'user_id', type: 'integer', isNullable: false },
          { name: 'parent_permission_id', type: 'integer', isNullable: true },
          {
            name: 'type',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'channel',
            type: 'varchar',
            isNullable: false,
          },
          { name: 'payload', type: 'jsonb', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            default: "'PENDING'",
            isNullable: false,
          },
          { name: 'sent_at', type: 'timestamptz', isNullable: true },
          { name: 'read_at', type: 'timestamptz', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('notifications', [
      new TableForeignKey({
        name: 'FK_notifications_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_notifications_parent_permission_id',
        columnNames: ['parent_permission_id'],
        referencedTableName: 'parent_permissions',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_in_app"
      ON "notifications" ("user_id", "channel", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_in_app"`,
    );
    await queryRunner.dropTable('notifications', true, true, true);
  }
}
