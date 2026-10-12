import type { FastifyInstance } from 'fastify';
import pg from 'pg';

// Row shapes for every table in db/schema.sql. Nullable columns are nullable there too.

export interface VetRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

export interface SpecialtyRow {
  id: number;
  name: string | null;
}

export interface VetSpecialtyRow {
  vet_id: number;
  specialty_id: number;
}

export interface PetTypeRow {
  id: number;
  name: string | null;
}

export interface OwnerRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  city: string | null;
  telephone: string | null;
}

/** `birth_date` is the raw `yyyy-MM-dd` string; see DATE_OID below. */
export interface PetRow {
  id: number;
  name: string | null;
  birth_date: string | null;
  type_id: number;
  owner_id: number;
}

/** `visit_date` is the raw `yyyy-MM-dd` string; see DATE_OID below. */
export interface VisitRow {
  id: number;
  pet_id: number;
  visit_date: string | null;
  description: string | null;
}

// pg turns DATE into a JS Date at local midnight, which shifts the day across time zones.
// Keep it as the `yyyy-MM-dd` text Postgres sends, like legacy's LocalDate.
const DATE_OID = 1082;

const types = new pg.TypeOverrides();
types.setTypeParser(DATE_OID, 'text', (value) => value);

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, types });
}

/** Decorates `app.db` with a pool that is closed when the app closes. */
export function registerDb(app: FastifyInstance, databaseUrl: string): void {
  const pool = createPool(databaseUrl);
  app.decorate('db', pool);
  app.addHook('onClose', async () => {
    await pool.end();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool;
  }
}
