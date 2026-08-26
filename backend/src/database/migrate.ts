import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { getPool } from './pool.js';

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const downMarker = '-- migrate:down';

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function migrationFiles(): Promise<string[]> {
  return (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort();
}

async function migrationSql(name: string): Promise<{ up: string; down: string }> {
  const contents = await readFile(join(migrationsDirectory, name), 'utf8');
  const markerIndex = contents.indexOf(downMarker);
  if (markerIndex < 0) throw new Error(`Migration ${name} has no ${downMarker} section`);
  return { up: contents.slice(0, markerIndex), down: contents.slice(markerIndex + downMarker.length) };
}

export async function migrateUp(): Promise<string[]> {
  const client = await getPool().connect();
  const applied: string[] = [];
  try {
    await client.query('BEGIN');
    await ensureMigrationTable(client);
    await client.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
    const existing = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const existingNames = new Set(existing.rows.map((row) => row.name));
    for (const name of await migrationFiles()) {
      if (existingNames.has(name)) continue;
      const sql = await migrationSql(name);
      await client.query(sql.up);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      applied.push(name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migrateDown(): Promise<string | null> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await ensureMigrationTable(client);
    await client.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
    const latest = await client.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1');
    const name = latest.rows[0]?.name;
    if (!name) {
      await client.query('COMMIT');
      return null;
    }
    const sql = await migrationSql(name);
    await client.query(sql.down);
    await client.query('DELETE FROM schema_migrations WHERE name = $1', [name]);
    await client.query('COMMIT');
    return name;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
