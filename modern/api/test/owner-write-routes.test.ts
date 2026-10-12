import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { NOT_EMPTY, TELEPHONE_OUT_OF_BOUNDS } from '../src/domain/owner.js';
import type { Owner } from '../src/queries.js';
import { resetDatabase } from '../src/reset.js';

const VALID = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  address: '12 St James Sq.',
  city: 'London',
  telephone: '0123456789',
};

describe('owner write endpoints', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => resetDatabase(app.config.databaseUrl));
  afterAll(() => app.close());

  async function getOwner(id: number): Promise<Owner> {
    return (await app.inject({ method: 'GET', url: `/api/owners/${String(id)}` })).json<Owner>();
  }

  describe('POST /api/owners', () => {
    it('creates an owner and returns 201 { id } after the seeded ids', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/owners', payload: VALID });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: 11 });
      expect(await getOwner(11)).toEqual({ id: 11, ...VALID, pets: [] });
    });

    it('ignores an id in the body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners',
        payload: { ...VALID, id: 1 },
      });
      expect(res.json()).toEqual({ id: 11 });
      expect((await getOwner(1)).firstName).toBe('George');
    });

    it('keeps values untrimmed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners',
        payload: { ...VALID, firstName: ' ', city: ' Paris ' },
      });
      const owner = await getOwner(res.json<{ id: number }>().id);
      expect(owner.firstName).toBe(' ');
      expect(owner.city).toBe(' Paris ');
    });

    it('returns 422 with one message per invalid field and saves nothing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners',
        payload: { firstName: '', lastName: 42, city: 'x', telephone: '123-456' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({
        errors: {
          firstName: NOT_EMPTY,
          lastName: NOT_EMPTY,
          address: NOT_EMPTY,
          telephone: TELEPHONE_OUT_OF_BOUNDS,
        },
      });
      const all = (await app.inject({ method: 'GET', url: '/api/owners' })).json<Owner[]>();
      expect(all).toHaveLength(10);
    });

    it('gives an empty telephone must not be empty (D9)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/owners',
        payload: { ...VALID, telephone: '' },
      });
      expect(res.json()).toEqual({ errors: { telephone: NOT_EMPTY } });
    });

    it('treats a missing body as all fields empty', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/owners' });
      expect(res.statusCode).toBe(422);
      expect(Object.keys(res.json<{ errors: object }>().errors)).toHaveLength(5);
    });
  });

  describe('PUT /api/owners/:id', () => {
    it('updates the owner and returns 204, keeping its pets', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/owners/6', payload: VALID });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      const owner = await getOwner(6);
      expect({ ...owner, pets: [] }).toEqual({ id: 6, ...VALID, pets: [] });
      expect(owner.pets.map((p) => p.name)).toEqual(['Max', 'Samantha']);
    });

    it('uses the path id, not a body id', async () => {
      await app.inject({ method: 'PUT', url: '/api/owners/6', payload: { ...VALID, id: 1 } });
      expect((await getOwner(1)).firstName).toBe('George');
      expect((await getOwner(6)).firstName).toBe('Ada');
    });

    it('binds the path id like legacy', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/owners/0x6', payload: VALID });
      expect(res.statusCode).toBe(204);
      expect((await getOwner(6)).firstName).toBe('Ada');
    });

    it('returns 422 and leaves the owner unchanged', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/owners/6',
        payload: { ...VALID, telephone: '12345678901' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ errors: { telephone: TELEPHONE_OUT_OF_BOUNDS } });
      expect((await getOwner(6)).firstName).toBe('Jean');
    });

    it('returns 404 for an unknown owner, after validation', async () => {
      const ok = await app.inject({ method: 'PUT', url: '/api/owners/999', payload: VALID });
      expect(ok.statusCode).toBe(404);
      expect(ok.json()).toEqual({ error: 'Owner 999 not found' });
      const bad = await app.inject({ method: 'PUT', url: '/api/owners/999', payload: {} });
      expect(bad.statusCode).toBe(422);
    });

    it('returns 400 for a non-numeric id', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/owners/abc', payload: VALID });
      expect(res.statusCode).toBe(400);
    });
  });
});
