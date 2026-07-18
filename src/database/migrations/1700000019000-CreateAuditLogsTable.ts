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
} from '../helpers/migration.helpers';

export class CreateAuditLogsTable1700000019000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'actor_id', type: 'integer', isNullable: true },
          {
            name: 'action',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'resource_reference',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          CREATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'audit_logs',
      new TableForeignKey({
        name: 'FK_audit_logs_actor_id',
        columnNames: ['actor_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_resource_reference"
      ON "audit_logs" ("resource_type", "resource_reference")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created_at"
      ON "audit_logs" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_audit_logs_resource_reference"`,
    );
    await queryRunner.dropTable('audit_logs', true, true, true);
  }
}
