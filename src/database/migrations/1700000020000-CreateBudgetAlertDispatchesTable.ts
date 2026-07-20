import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

import { INTEGER_PK_COLUMN } from '../helpers/migration.helpers';

export class CreateBudgetAlertDispatchesTable1700000020000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'budget_alert_dispatches',
        columns: [
          INTEGER_PK_COLUMN,
          { name: 'department_budget_id', type: 'integer', isNullable: false },
          { name: 'threshold_percent', type: 'smallint', isNullable: false },
          {
            name: 'dispatched_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_budget_alert_dispatches_budget_threshold',
            columnNames: ['department_budget_id', 'threshold_percent'],
          }),
        ],
        foreignKeys: [
          {
            name: 'FK_budget_alert_dispatches_department_budget_id',
            columnNames: ['department_budget_id'],
            referencedTableName: 'department_budgets',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('budget_alert_dispatches', true, true, true);
  }
}
