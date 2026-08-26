import '../env.js';
import { Client } from 'pg';
import { closePool } from './pool.js';
import { migrateUp } from './migrate.js';
import { seedDatabase } from './seed.js';

export function testDatabaseUrl(source = process.env.DATABASE_URL): string {
  if (!source) throw new Error('DATABASE_URL is required to derive the test database');
  const url = new URL(source);
  const sourceName = decodeURIComponent(url.pathname.slice(1));
  if (!sourceName) throw new Error('DATABASE_URL must name a database');
  const testName = sourceName.endsWith('_test') ? sourceName : `${sourceName}_test`;
  url.pathname = `/${testName}`;
  return url.toString();
}

export async function resetTestDatabase(): Promise<string> {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error('DATABASE_URL is required');
  const target = new URL(testDatabaseUrl(source));
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!databaseName.endsWith('_test') || !/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error(`Refusing to reset unsafe test database name: ${databaseName}`);
  }
  const maintenance = new URL(source);
  maintenance.pathname = '/postgres';
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }

  process.env.DATABASE_URL = target.toString();
  await closePool();
  await migrateUp();
  await seedDatabase();
  await closePool();
  return target.toString();
}
