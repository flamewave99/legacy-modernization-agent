import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { DUPLICATE, INVALID_DATE, INVALID_VALUE, REQUIRED } from '../src/domain/pet.js';
import type { PetWithOwner } from '../src/queries.js';
import { resetDatabase } from '../src/reset.js';

const VALID = { name: 'Rex', birthDate: '2020-01-02', type: 'dog' };

describe('pet write endpoints', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => resetDatabase(app.config.databaseUrl));
  afterAll(() => app.close());

  async function getPet(ownerId: number, petId: number): Promise<PetWithOwner> {
    const url = `/api/owners/${String(ownerId)}/pets/${String(petId)}`;
    return (await app.inject({ method: 'GET', url })).json<PetWithOwner>();
  }

  describe('POST /api/owners/:ownerId/pets', () => {
    it('creates a pet and returns 201 { id } after the seeded ids', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/owners/1/pets', payload: VALID });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: 14 });
      const pet = await getPet(1, 14);
      expect(pet).toMatchObject({ ...VALID, id: 14, visits: [] });
      expect(pet.owner.id).toBe(1);
    });

    it('accepts yyyy/MM/dd and a future birth date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners/1/pets',
        payload: { ...VALID, birthDate: '2999/12/31' },
      });
      expect((await getPet(1, res.json<{ id: number }>().id)).birthDate).toBe('2999-12-31');
    });

    it('ignores ids in the body (D7)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners/1/pets',
        payload: { ...VALID, id: 2, ownerId: 3 },
      });
      expect(res.json()).toEqual({ id: 14 });
      expect((await getPet(1, 14)).owner.id).toBe(1);
      expect((await getPet(2, 2)).name).toBe('Basil');
    });

    it('rejects a duplicate name case-insensitively, but not one from another owner', async () => {
      const dup = await app.inject({
        method: 'POST',
        url: '/api/owners/6/pets',
        payload: { ...VALID, name: 'mAX' },
      });
      expect(dup.statusCode).toBe(422);
      expect(dup.json()).toEqual({ errors: { name: DUPLICATE } });
      const other = await app.inject({
        method: 'POST',
        url: '/api/owners/1/pets',
        payload: { ...VALID, name: 'Max' },
      });
      expect(other.statusCode).toBe(201);
    });

    it('returns 422 with one message per field and saves nothing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners/1/pets',
        payload: { name: '', birthDate: '2020-02-30' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({
        errors: { name: REQUIRED, type: REQUIRED, birthDate: INVALID_DATE },
      });
      expect((await app.inject({ method: 'GET', url: '/api/owners/1' })).json()).toMatchObject({
        pets: [{ name: 'Leo' }],
      });
    });

    it('rejects an unknown type name with invalid value (D5)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners/1/pets',
        payload: { ...VALID, type: '<script>alert(1)</script>' },
      });
      expect(res.json()).toEqual({ errors: { type: INVALID_VALUE } });
    });

    it('returns 404 for an unknown owner, even with a bad body', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/owners/999/pets', payload: {} });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'Owner 999 not found' });
    });

    it('returns 400 for a non-numeric owner id', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/owners/x/pets', payload: VALID });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/owners/:ownerId/pets/:petId', () => {
    it('updates the pet and returns 204, keeping its visits', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/owners/6/pets/7', payload: VALID });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      const pet = await getPet(6, 7);
      expect(pet).toMatchObject({ ...VALID, id: 7 });
      expect(pet.visits).toHaveLength(2);
    });

    it('allows renaming to a sibling name', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/owners/6/pets/7',
        payload: { ...VALID, name: 'Max' },
      });
      expect(res.statusCode).toBe(204);
    });

    it('keeps the current type when none is given', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/owners/6/pets/7',
        payload: { name: 'Sam', birthDate: '2012-09-04' },
      });
      expect(res.statusCode).toBe(204);
      expect((await getPet(6, 7)).type).toBe('cat');
    });

    it('uses the path ids, never body ids (D7)', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/owners/6/pets/7',
        payload: { ...VALID, id: 1, ownerId: 1 },
      });
      expect((await getPet(1, 1)).name).toBe('Leo');
      expect((await getPet(6, 7)).owner.id).toBe(6);
    });

    it("returns 404 for another owner's pet and leaves it unchanged", async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/owners/1/pets/7', payload: VALID });
      expect(res.statusCode).toBe(404);
      expect((await getPet(6, 7)).name).toBe('Samantha');
    });

    it('validates before looking up the pet', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/owners/1/pets/999', payload: {} });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ errors: { name: REQUIRED, birthDate: REQUIRED } });
    });

    it('returns 404 for an unknown owner and 400 for a non-numeric pet id', async () => {
      const missing = await app.inject({
        method: 'PUT',
        url: '/api/owners/999/pets/1',
        payload: VALID,
      });
      expect(missing.statusCode).toBe(404);
      const bad = await app.inject({ method: 'PUT', url: '/api/owners/1/pets/x', payload: VALID });
      expect(bad.statusCode).toBe(400);
    });
  });
});
