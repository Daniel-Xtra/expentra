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

export class CreateDepartmentManagerHistoryTable1700000022000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'department_manager_history',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'department_id', type: 'integer', isNullable: false },
          { name: 'manager_id', type: 'integer', isNullable: true },
          { name: 'assigned_by_id', type: 'integer', isNullable: true },
          { name: 'started_at', type: 'timestamptz', isNullable: false },
          { name: 'ended_at', type: 'timestamptz', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('department_manager_history', [
      new TableForeignKey({
        name: 'FK_department_manager_history_department_id',
        columnNames: ['department_id'],
        referencedTableName: 'departments',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_department_manager_history_manager_id',
        columnNames: ['manager_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_department_manager_history_assigned_by_id',
        columnNames: ['assigned_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.query(`
      CREATE INDEX "IDX_department_manager_history_department_started"
      ON "department_manager_history" ("department_id", "started_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_department_manager_history_department_open"
      ON "department_manager_history" ("department_id")
      WHERE "ended_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_department_manager_history_department_open"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_department_manager_history_department_started"`,
    );
    await queryRunner.dropTable('department_manager_history', true, true, true);
  }
}
