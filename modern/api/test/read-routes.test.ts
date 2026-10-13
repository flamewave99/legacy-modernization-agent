import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Owner, PetType, PetWithOwner, Vet } from '../src/queries.js';
import { resetDatabase } from '../src/reset.js';

describe('read endpoints', () => {
  const app = buildApp({ logger: false });

  beforeAll(() => resetDatabase(app.config.databaseUrl));
  afterAll(() => app.close());

  function get(url: string) {
    return app.inject({ method: 'GET', url });
  }

  async function searchIds(lastName?: string): Promise<number[]> {
    const url =
      lastName === undefined
        ? '/api/owners'
        : `/api/owners?lastName=${encodeURIComponent(lastName)}`;
    const res = await get(url);
    const status = res.statusCode;
    const body = res.json<Owner[]>();
    expect(status).toBe(200);
    return body.map((o) => o.id);
  }

  describe('GET /api/owners', () => {
    it('returns every owner ordered by id without lastName', async () => {
      expect(await searchIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(await searchIds('')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('matches a case-insensitive prefix', async () => {
      expect(await searchIds('dav')).toEqual([2, 4]);
      expect(await searchIds('DAV')).toEqual([2, 4]);
      expect(await searchIds('davis')).toEqual([2, 4]);
      expect(await searchIds('avis')).toEqual([]);
    });

    it('keeps LIKE wildcards unescaped and does not trim', async () => {
      expect(await searchIds('D_v')).toEqual([2, 4]);
      expect(await searchIds('%avis')).toEqual([2, 4, 5]); // McTavish
      expect(await searchIds(' Davis')).toEqual([]);
      expect(await searchIds('\\')).toEqual([]);
    });

    it('joins a repeated lastName with commas, like Spring', async () => {
      const body = (await get('/api/owners?lastName=Dav&lastName=x')).json<Owner[]>();
      expect(body).toEqual([]);
    });

    it('includes pets', async () => {
      const body = (await get('/api/owners?lastName=Coleman')).json<Owner[]>();
      expect(body[0]?.pets.map((p) => p.name)).toEqual(['Max', 'Samantha']);
    });
  });

  describe('GET /api/owners/:id', () => {
    it('returns the owner with pets sorted by name and visits by date descending', async () => {
      const res = await get('/api/owners/6');
      const status = res.statusCode;
      const body = res.json<Owner>();
      expect(status).toBe(200);
      expect(body).toEqual({
        id: 6,
        firstName: 'Jean',
        lastName: 'Coleman',
        address: '105 N. Lake St.',
        city: 'Monona',
        telephone: '6085552654',
        pets: [
          {
            id: 8,
            name: 'Max',
            birthDate: '2012-09-04',
            type: 'cat',
            visits: [
              { id: 3, date: '2013-01-03', description: 'neutered' },
              { id: 2, date: '2013-01-02', description: 'rabies shot' },
            ],
          },
          {
            id: 7,
            name: 'Samantha',
            birthDate: '2012-09-04',
            type: 'cat',
            visits: [
              { id: 4, date: '2013-01-04', description: 'spayed' },
              { id: 1, date: '2013-01-01', description: 'rabies shot' },
            ],
          },
        ],
      });
    });

    it('returns an owner without pets', async () => {
      await app.db.query(
        "INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES ('A', 'Petless', 'x', 'y', '1')",
      );
      const body = (await get('/api/owners?lastName=Petless')).json<Owner[]>();
      expect(body[0]?.pets).toEqual([]);
    });

    it('accepts ids the way legacy binds them', async () => {
      expect((await get('/api/owners/0x1')).json<Owner>().firstName).toBe('George');
      expect((await get('/api/owners/+1')).json<Owner>().firstName).toBe('George');
    });

    it('returns 404 for an unknown owner', async () => {
      const res = await get('/api/owners/999999');
      const status = res.statusCode;
      const body = res.json<unknown>();
      expect(status).toBe(404);
      expect(body).toEqual({ error: 'Owner 999999 not found' });
      expect((await get('/api/owners/-1')).statusCode).toBe(404);
    });

    it('returns 400 for a non-numeric id', async () => {
      expect((await get('/api/owners/abc')).statusCode).toBe(400);
      expect((await get('/api/owners/1.0')).statusCode).toBe(400);
      expect((await get('/api/owners/2147483648')).statusCode).toBe(400);
    });
  });

  describe('GET /api/owners/:ownerId/pets/:petId', () => {
    it('returns the pet with its owner name and sorted visits', async () => {
      const res = await get('/api/owners/6/pets/7');
      const status = res.statusCode;
      const body = res.json<PetWithOwner>();
      expect(status).toBe(200);
      expect(body).toEqual({
        id: 7,
        name: 'Samantha',
        birthDate: '2012-09-04',
        type: 'cat',
        visits: [
          { id: 4, date: '2013-01-04', description: 'spayed' },
          { id: 1, date: '2013-01-01', description: 'rabies shot' },
        ],
        owner: { id: 6, firstName: 'Jean', lastName: 'Coleman' },
      });
    });

    it('ignores the owner id in the path, like legacy (D8)', async () => {
      const res = await get('/api/owners/1/pets/7');
      const status = res.statusCode;
      const body = res.json<PetWithOwner>();
      expect(status).toBe(200);
      expect(body.owner.id).toBe(6);
    });

    it('returns 404 for an unknown pet and 400 for non-numeric ids', async () => {
      expect((await get('/api/owners/1/pets/999999')).statusCode).toBe(404);
      expect((await get('/api/owners/1/pets/abc')).statusCode).toBe(400);
      expect((await get('/api/owners/abc/pets/1')).statusCode).toBe(400);
    });
  });

  describe('GET /api/pets/:petId', () => {
    it('returns the pet with its owner, as the owner-scoped route does', async () => {
      const res = await get('/api/pets/7');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual((await get('/api/owners/6/pets/7')).json());
    });

    it('returns 404 for an unknown pet and 400 for a non-numeric id', async () => {
      expect((await get('/api/pets/999999')).statusCode).toBe(404);
      expect((await get('/api/pets/abc')).statusCode).toBe(400);
    });
  });

  it('GET /api/pettypes lists types by name', async () => {
    const body = (await get('/api/pettypes')).json<PetType[]>();
    expect(body.map((t) => t.name)).toEqual(['bird', 'cat', 'dog', 'hamster', 'lizard', 'snake']);
    expect(body[0]).toEqual({ id: 5, name: 'bird' });
  });

  it('GET /api/vets sorts vets by last then first name and specialties by name', async () => {
    const body = (await get('/api/vets')).json<Vet[]>();
    expect(body.map((v) => v.lastName)).toEqual([
      'Carter',
      'Douglas',
      'Jenkins',
      'Leary',
      'Ortega',
      'Stevens',
    ]);
    expect(body[1]).toEqual({
      id: 3,
      firstName: 'Linda',
      lastName: 'Douglas',
      specialties: [
        { id: 3, name: 'dentistry' },
        { id: 2, name: 'surgery' },
      ],
    });
    expect(body[0]?.specialties).toEqual([]);
  });
});
