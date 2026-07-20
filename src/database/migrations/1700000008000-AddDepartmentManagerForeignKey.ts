import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddDepartmentManagerForeignKey1700000008000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createForeignKey(
      'departments',
      new TableForeignKey({
        name: 'FK_departments_manager_id',
        columnNames: ['manager_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('departments', 'FK_departments_manager_id');
  }
}
