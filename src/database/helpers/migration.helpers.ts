import { QueryRunner } from 'typeorm';

import {
  APPROVAL_DECISION_ENUM,
  APPROVAL_DECISION_VALUES,
  EXPENSE_STATUS_ENUM,
  EXPENSE_STATUS_VALUES,
  NOTIFICATION_CHANNEL_ENUM,
  NOTIFICATION_CHANNEL_VALUES,
  NOTIFICATION_STATUS_ENUM,
  NOTIFICATION_STATUS_VALUES,
  PERMISSION_ACTION_ENUM,
  PERMISSION_ACTION_VALUES,
  PERMISSION_RESOURCE_ENUM,
  PERMISSION_RESOURCE_VALUES,
  PERMISSION_SCOPE_ENUM,
  PERMISSION_SCOPE_VALUES,
} from './domain-migration.enums';

function enumLabels(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

export const INTEGER_PK_COLUMN = {
  name: 'id',

  type: 'integer',

  isPrimary: true,

  isGenerated: true,

  generationStrategy: 'increment' as const,
};

export const REFERENCE_COLUMN = {
  name: 'reference',
  type: 'varchar',
  length: '36',
  isNullable: false,
  isUnique: true,
};

export const SOFT_DELETE_COLUMN = {
  name: 'deleted_at',
  type: 'timestamptz',
  isNullable: true,
};

export const CREATED_AT_COLUMN = {
  name: 'created_at',
  type: 'timestamptz',
  default: 'now()',
};

export const UPDATED_AT_COLUMN = {
  name: 'updated_at',
  type: 'timestamptz',
  default: 'now()',
};

export async function createDomainEnums(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(
    `CREATE TYPE "${EXPENSE_STATUS_ENUM}" AS ENUM (${enumLabels(EXPENSE_STATUS_VALUES)})`,
  );

  await queryRunner.query(
    `CREATE TYPE "${APPROVAL_DECISION_ENUM}" AS ENUM (${enumLabels(APPROVAL_DECISION_VALUES)})`,
  );

  await queryRunner.query(
    `CREATE TYPE "${NOTIFICATION_CHANNEL_ENUM}" AS ENUM (${enumLabels(NOTIFICATION_CHANNEL_VALUES)})`,
  );

  await queryRunner.query(
    `CREATE TYPE "${NOTIFICATION_STATUS_ENUM}" AS ENUM (${enumLabels(NOTIFICATION_STATUS_VALUES)})`,
  );

  await queryRunner.query(
    `CREATE TYPE "${PERMISSION_ACTION_ENUM}" AS ENUM (${enumLabels(PERMISSION_ACTION_VALUES)})`,
  );

  await queryRunner.query(
    `CREATE TYPE "${PERMISSION_RESOURCE_ENUM}" AS ENUM (${enumLabels(PERMISSION_RESOURCE_VALUES)})`,
  );

  await queryRunner.query(
    `CREATE TYPE "${PERMISSION_SCOPE_ENUM}" AS ENUM (${enumLabels(PERMISSION_SCOPE_VALUES)})`,
  );
}

export async function dropDomainEnums(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DROP TYPE IF EXISTS "${PERMISSION_SCOPE_ENUM}"`);

  await queryRunner.query(`DROP TYPE IF EXISTS "${PERMISSION_RESOURCE_ENUM}"`);

  await queryRunner.query(`DROP TYPE IF EXISTS "${PERMISSION_ACTION_ENUM}"`);

  await queryRunner.query(`DROP TYPE IF EXISTS "${NOTIFICATION_STATUS_ENUM}"`);

  await queryRunner.query(`DROP TYPE IF EXISTS "${NOTIFICATION_CHANNEL_ENUM}"`);

  await queryRunner.query(`DROP TYPE IF EXISTS "${APPROVAL_DECISION_ENUM}"`);

  await queryRunner.query(`DROP TYPE IF EXISTS "${EXPENSE_STATUS_ENUM}"`);
}

export {
  APPROVAL_DECISION_ENUM,
  EXPENSE_STATUS_ENUM,
  NOTIFICATION_CHANNEL_ENUM,
  NOTIFICATION_STATUS_ENUM,
  PERMISSION_ACTION_ENUM,
  PERMISSION_RESOURCE_ENUM,
  PERMISSION_SCOPE_ENUM,
};
