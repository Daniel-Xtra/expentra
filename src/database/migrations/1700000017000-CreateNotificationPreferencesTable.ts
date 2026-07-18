import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreateNotificationPreferencesTable1700000017000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
        columns: [
          INTEGER_PK_COLUMN,
          { name: 'user_id', type: 'integer', isNullable: false, isUnique: true },
          { name: 'email_enabled', type: 'boolean', default: true },
          { name: 'in_app_enabled', type: 'boolean', default: true },
          {
            name: 'type_preferences',
            type: 'jsonb',
            default: "'{}'",
          },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'notification_preferences',
      new TableForeignKey({
        name: 'FK_notification_preferences_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notification_preferences', true, true, true);
  }
}
