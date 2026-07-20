import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

import {
  CREATED_AT_COLUMN,
  INTEGER_PK_COLUMN,
  REFERENCE_COLUMN,
  SOFT_DELETE_COLUMN,
  UPDATED_AT_COLUMN,
} from '../helpers/migration.helpers';

export class CreateDepartmentBudgetsTable1700000009000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'department_budgets',
        columns: [
          INTEGER_PK_COLUMN,
          REFERENCE_COLUMN,
          { name: 'department_id', type: 'integer', isNullable: false },
          { name: 'year', type: 'smallint', isNullable: false },
          { name: 'amount_limit', type: 'bigint', isNullable: false },
          { name: 'currency', type: 'varchar', length: '3', default: "'NGN'" },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'committed_amount', type: 'bigint', default: 0 },
          { name: 'reimbursed_amount', type: 'bigint', default: 0 },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          CREATED_AT_COLUMN,
          UPDATED_AT_COLUMN,
          SOFT_DELETE_COLUMN,
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_department_budget_annual_unique',
            columnNames: ['department_id', 'year'],
          }),
        ],
        foreignKeys: [
          {
            name: 'FK_department_budgets_department_id',
            columnNames: ['department_id'],
            referencedTableName: 'departments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(`
      ALTER TABLE "department_budgets"
      ADD COLUMN "remaining_amount" bigint GENERATED ALWAYS AS (
        GREATEST(0, amount_limit - committed_amount)
      ) STORED
    `);

    await queryRunner.query(`
      ALTER TABLE "department_budgets"
      ADD COLUMN "utilization_percent" numeric(7, 2) GENERATED ALWAYS AS (
        CASE
          WHEN amount_limit > 0 THEN
            ROUND((committed_amount::numeric / amount_limit) * 10000) / 100
          ELSE 0
        END
      ) STORED
    `);

    await queryRunner.query(`
      ALTER TABLE "department_budgets"
      ADD COLUMN "is_over_budget" boolean GENERATED ALWAYS AS (
        committed_amount > amount_limit
      ) STORED
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('department_budgets', true, true, true);
  }
}
