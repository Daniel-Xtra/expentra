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
  SOFT_DELETE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreateUsersTable1700000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'email', type: 'varchar', isNullable: false, isUnique: true },
          { name: 'password', type: 'varchar', isNullable: true },
          {
            name: 'auth_provider',
            type: 'varchar',
            length: '32',
            default: "'local'",
          },
          {
            name: 'external_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'first_name', type: 'varchar', isNullable: true },
          { name: 'last_name', type: 'varchar', isNullable: true },
          {
            name: 'avatar_url',
            type: 'varchar',
            length: '2048',
            isNullable: true,
          },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'is_email_verified', type: 'boolean', default: false },
          { name: 'email_verified_at', type: 'timestamptz', isNullable: true },
          { name: 'role_id', type: 'integer', isNullable: true },
          { name: 'department_id', type: 'integer', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
          { name: 'deactivated_at', type: 'timestamptz', isNullable: true },
          SOFT_DELETE_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('users', [
      new TableForeignKey({
        name: 'FK_users_role_id',
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_users_department_id',
        columnNames: ['department_id'],
        referencedTableName: 'departments',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_auth_provider_external_id"
      ON "users" ("auth_provider", "external_id")
      WHERE "external_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_auth_provider_external_id"`,
    );
    await queryRunner.dropTable('users', true, true, true);
  }
}
