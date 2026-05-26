import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * This DataSource is only used by the TypeORM CLI (migration:generate, migration:run, etc.).
 * The Nest application itself uses `TypeOrmModule.forRootAsync` which reads the same
 * environment variables via `ConfigService`. Keeping a separate file avoids a circular
 * dependency and satisfies the `-d <data-source>` flag used in npm scripts.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  logging: process.env.POSTGRES_LOGGING === 'true',
  synchronize: false,
  migrations: [__dirname + '/migrations/[0-9]*-*.{ts,js}'],
  migrationsTableName: 'migrations',
  entities: [__dirname + '/../**/*.entity.{js,ts}'],
  extra: {
    ssl:
      process.env.POSTGRES_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
  },
});

export default AppDataSource;
