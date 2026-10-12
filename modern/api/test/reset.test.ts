import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { resetDatabase } from '../src/reset.js';

const { databaseUrl } = loadConfig();

describe('db reset', () => {
  const client = new pg.Client({ connectionString: databaseUrl });

  beforeAll(async () => {
    await resetDatabase(databaseUrl);
    await client.connect();
  });
  afterAll(() => client.end());

  async function count(table: string): Promise<number> {
    const res = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    return res.rows[0]?.n ?? -1;
  }

  it('seeds the H2 row counts', async () => {
    expect(await count('owners')).toBe(10);
    expect(await count('pets')).toBe(13);
    expect(await count('visits')).toBe(4);
    expect(await count('vets')).toBe(6);
    expect(await count('types')).toBe(6);
    expect(await count('specialties')).toBe(3);
    expect(await count('vet_specialties')).toBe(5);
  });

  it('uses the H2 dates, not the postgresql/data.sql ones', async () => {
    const res = await client.query<{ birth: string }>(
      "SELECT to_char(birth_date, 'YYYY-MM-DD') AS birth FROM pets WHERE id = 1",
    );
    expect(res.rows[0]?.birth).toBe('2010-09-07');
  });

  it('sets sequences so the next id follows max(id)', async () => {
    const tables = ['vets', 'specialties', 'types', 'owners', 'pets', 'visits'];
    const next: (number | undefined)[] = [];
    for (const t of tables) {
      const res = await client.query<{ n: number }>(`SELECT last_value::int AS n FROM ${t}_id_seq`);
      next.push(res.rows[0]?.n);
    }
    expect(next).toEqual([6, 3, 6, 10, 13, 4]);
  });

  it('can run twice', async () => {
    await resetDatabase(databaseUrl);
    expect(await count('owners')).toBe(10);
  });
});
