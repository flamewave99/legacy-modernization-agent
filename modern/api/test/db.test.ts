import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { PetRow, PetTypeRow } from '../src/db.js';
import { resetDatabase } from '../src/reset.js';

describe('db pool', () => {
  const app = buildApp({ logger: false });

  beforeAll(() => resetDatabase(app.config.databaseUrl));
  afterAll(() => app.close());

  it('lists pet types ordered by name', async () => {
    const res = await app.db.query<PetTypeRow>('SELECT id, name FROM types ORDER BY name');
    expect(res.rows.map((r) => r.name)).toEqual([
      'bird',
      'cat',
      'dog',
      'hamster',
      'lizard',
      'snake',
    ]);
  });

  it('returns DATE columns as yyyy-MM-dd strings', async () => {
    const res = await app.db.query<PetRow>('SELECT * FROM pets WHERE id = 1');
    expect(res.rows[0]?.birth_date).toBe('2010-09-07');
  });

  it('ends the pool when the app closes', async () => {
    const other = buildApp({ logger: false });
    await other.ready();
    await other.close();
    expect(other.db.ended).toBe(true);
  });
});
