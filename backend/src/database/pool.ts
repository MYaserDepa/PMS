import '../env.js';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | undefined;

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value || !value.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  return value;
}

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: databaseUrl() });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}

export async function inTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}
