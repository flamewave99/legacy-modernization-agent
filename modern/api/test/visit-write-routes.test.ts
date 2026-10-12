import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { NOT_EMPTY } from '../src/domain/owner.js';
import { INVALID_DATE, REQUIRED } from '../src/domain/pet.js';
import type { PetWithOwner } from '../src/queries.js';
import { resetDatabase } from '../src/reset.js';

const VALID = { date: '2020-01-02', description: 'checkup' };

describe('POST /api/owners/:ownerId/pets/:petId/visits', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => resetDatabase(app.config.databaseUrl));
  afterAll(() => app.close());

  function post(url: string, payload: unknown) {
    return app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });
  }

  async function getPet(ownerId: number, petId: number): Promise<PetWithOwner> {
    const url = `/api/owners/${String(ownerId)}/pets/${String(petId)}`;
    return (await app.inject({ method: 'GET', url })).json<PetWithOwner>();
  }

  it('creates a visit and returns 201 { id } after the seeded ids', async () => {
    const res = await post('/api/owners/6/pets/7/visits', VALID);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: 5 });
    const pet = await getPet(6, 7);
    expect(pet.visits[0]).toEqual({ id: 5, ...VALID });
    expect(pet.visits).toHaveLength(3);
  });

  it('accepts yyyy/MM/dd and keeps a whitespace-only description', async () => {
    const res = await post('/api/owners/1/pets/1/visits', { date: '2021/03/04', description: ' ' });
    expect(res.statusCode).toBe(201);
    expect((await getPet(1, 1)).visits).toEqual([{ id: 5, date: '2021-03-04', description: ' ' }]);
  });

  it('requires a date (D1 fix): blank gives 422 is required and saves nothing', async () => {
    for (const date of ['', '   ', undefined]) {
      const res = await post('/api/owners/1/pets/1/visits', { ...VALID, date });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ errors: { date: REQUIRED } });
    }
    expect((await getPet(1, 1)).visits).toEqual([]);
  });

  it('returns 422 with every field error', async () => {
    const res = await post('/api/owners/1/pets/1/visits', { date: '2020-02-30', description: '' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ errors: { date: INVALID_DATE, description: NOT_EMPTY } });
  });

  it('treats non-string fields and a non-object body as missing', async () => {
    const res = await post('/api/owners/1/pets/1/visits', { date: 20200102, description: 1 });
    expect(res.json()).toEqual({ errors: { date: REQUIRED, description: NOT_EMPTY } });
    const empty = await post('/api/owners/1/pets/1/visits', []);
    expect(empty.statusCode).toBe(422);
  });

  it('ignores ids in the body', async () => {
    const res = await post('/api/owners/1/pets/1/visits', { ...VALID, id: 1, petId: 7 });
    expect(res.json()).toEqual({ id: 5 });
    expect((await getPet(6, 7)).visits).toHaveLength(2);
  });

  it('does not check that the pet belongs to the owner (D8, parity)', async () => {
    const res = await post('/api/owners/1/pets/7/visits', VALID);
    expect(res.statusCode).toBe(201);
    expect((await getPet(6, 7)).visits).toHaveLength(3);
  });

  it('returns 404 for an unknown pet, before validating the body', async () => {
    const res = await post('/api/owners/1/pets/999/visits', {});
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Pet 999 not found' });
  });

  it('returns 400 for a non-numeric id', async () => {
    expect((await post('/api/owners/abc/pets/1/visits', VALID)).statusCode).toBe(400);
    expect((await post('/api/owners/1/pets/abc/visits', VALID)).statusCode).toBe(400);
  });
});
