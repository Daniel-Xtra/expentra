import { MigrationInterface, QueryRunner } from 'typeorm';

import {
  createDomainEnums,
  dropDomainEnums,
} from '../helpers/migration.helpers';

export class CreateDomainEnums1700000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await createDomainEnums(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropDomainEnums(queryRunner);
  }
}
