import { Client } from 'pg';
import { migrateUp } from './migrate.js';
import { closePool } from './pool.js';
import { seedDatabase } from './seed.js';

const localDatabaseHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const protectedDatabaseNames = new Set(['postgres', 'template0', 'template1']);

export function developmentDatabaseName(environment: NodeJS.ProcessEnv): string {
  if (environment.NODE_ENV !== 'development') {
    throw new Error('Refusing to reset because NODE_ENV is not development');
  }
  if (environment.PMS_ALLOW_DATABASE_RESET !== 'true') {
    throw new Error('Refusing to reset because PMS_ALLOW_DATABASE_RESET is not true');
  }

  const source = environment.DATABASE_URL;
  if (!source) throw new Error('DATABASE_URL is required');

  const url = new URL(source);
  if (url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgresql protocol');
  }
  if (!localDatabaseHosts.has(url.hostname)) {
    throw new Error(`Refusing to reset a database on non-local host ${url.hostname}`);
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!databaseName || !/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error(`Refusing to reset unsafe database name: ${databaseName || '(empty)'}`);
  }
  if (protectedDatabaseNames.has(databaseName) || databaseName.endsWith('_test')) {
    throw new Error(`Refusing to reset protected development database: ${databaseName}`);
  }

  return databaseName;
}

export async function resetDevelopmentDatabase(): Promise<string> {
  const databaseName = developmentDatabaseName(process.env);
  const source = process.env.DATABASE_URL!;
  const maintenance = new URL(source);
  maintenance.pathname = '/postgres';

  await closePool();
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }

  try {
    await migrateUp();
    await seedDatabase();
  } finally {
    await closePool();
  }
  return databaseName;
}
