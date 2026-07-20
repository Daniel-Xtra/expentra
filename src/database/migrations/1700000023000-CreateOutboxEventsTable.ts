import { MigrationInterface, QueryRunner, Table } from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
} from '../helpers/migration.helpers';

export class CreateOutboxEventsTable1700000023000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'outbox_events',
        columns: [
          INTEGER_PK_COLUMN,
          {
            name: 'event_type',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          { name: 'payload', type: 'jsonb', isNullable: false },
          {
            name: 'correlation_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
          },
          { name: 'processed_at', type: 'timestamptz', isNullable: true },
          { name: 'dispatched_at', type: 'timestamptz', isNullable: true },
          CREATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_outbox_events_unprocessed"
      ON "outbox_events" ("created_at")
      WHERE "processed_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_outbox_events_unprocessed"`,
    );
    await queryRunner.dropTable('outbox_events', true, true, true);
  }
}
