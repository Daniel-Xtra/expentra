import 'dotenv/config';
import path from 'path';
import { DataSource } from 'typeorm';
import * as fs from 'fs';

const sourceExt = __filename.endsWith('.ts') ? 'ts' : 'js';

function buildPostgresSsl():
  | false
  | {
      rejectUnauthorized: boolean;
      ca?: string;
    } {
  if (process.env.POSTGRES_SSL !== 'true') {
    return false;
  }

  const ssl: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized:
      process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false',
  };

  const caPath = process.env.POSTGRES_SSL_CA?.trim();
  if (caPath) {
    ssl.ca = fs.readFileSync(path.resolve(caPath), 'utf8');
  }

  return ssl;
}

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  logging: process.env.POSTGRES_LOGGING === 'true',
  synchronize: false,
  migrationsTableName: 'migrations',
  migrationsTransactionMode: 'each',
  entities: [path.join(__dirname, 'entities', `**/*.entity.${sourceExt}`)],
  migrations: [path.join(__dirname, 'migrations', `*.${sourceExt}`)],
  extra: {
    ssl: buildPostgresSsl(),
  },
});

export default AppDataSource;
