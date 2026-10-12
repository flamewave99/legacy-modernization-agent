import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Resolves to modern/api/db from both src/ (tests) and dist/ (compiled script).
const DB_DIR = new URL('../db/', import.meta.url);

export async function readSql(name: 'schema.sql' | 'seed.sql'): Promise<string> {
  return readFile(new URL(name, DB_DIR), 'utf8');
}

/** Drops all tables, recreates the schema and loads the H2 seed, in one transaction. */
export async function resetDatabase(databaseUrl: string): Promise<void> {
  const [schema, seed] = await Promise.all([readSql('schema.sql'), readSql('seed.sql')]);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query(seed);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}
