// Read queries. The SQL mirrors legacy's JdbcOwnerRepositoryImpl, JdbcPetRepositoryImpl and
// JdbcVetRepositoryImpl; the Java-side sorting (SPEC §5.2) happens here in JS, not in SQL, so
// Postgres collation never decides an order that legacy decided in Java.

import type pg from 'pg';
import type { OwnerRow, PetRow, PetTypeRow, SpecialtyRow, VetRow, VisitRow } from './db.js';
import {
  sortPetsByName,
  sortSpecialtiesByName,
  sortVets,
  sortVisitsByDateDesc,
} from './domain/sorting.js';

// Nullable text columns become '' in the API, as JSP renders a null `${...}` as empty text.

export interface Visit {
  id: number;
  /** `yyyy-MM-dd`; null only for rows legacy saved before the D1 fix. */
  date: string | null;
  description: string;
}

export interface Pet {
  id: number;
  name: string;
  /** `yyyy-MM-dd`. */
  birthDate: string | null;
  /** Pet type name. */
  type: string;
  visits: Visit[];
}

export interface Owner {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  pets: Pet[];
}

export interface PetWithOwner extends Pet {
  owner: { id: number; firstName: string; lastName: string };
}

export interface PetType {
  id: number;
  name: string;
}

export interface Specialty {
  id: number;
  name: string;
}

export interface Vet {
  id: number;
  firstName: string;
  lastName: string;
  specialties: Specialty[];
}

const OWNER_COLUMNS = 'id, first_name, last_name, address, city, telephone';

/**
 * Owners whose last name starts with `lastName`, case-insensitively (legacy's H2 column is
 * VARCHAR_IGNORECASE). `%` and `_` stay wildcards, as in legacy [SPEC §5.1].
 */
export async function findOwnersByLastName(db: pg.Pool, lastName: string): Promise<Owner[]> {
  const { rows } = await db.query<OwnerRow>(
    `SELECT ${OWNER_COLUMNS} FROM owners WHERE last_name ILIKE $1 || '%' ORDER BY id`,
    [lastName],
  );
  return withPets(db, rows);
}

export async function findOwnerById(db: pg.Pool, id: number): Promise<Owner | undefined> {
  const { rows } = await db.query<OwnerRow>(`SELECT ${OWNER_COLUMNS} FROM owners WHERE id = $1`, [
    id,
  ]);
  return (await withPets(db, rows))[0];
}

/** A pet by id alone: like legacy, it does not check the owner in the URL (D8). */
export async function findPetById(db: pg.Pool, id: number): Promise<PetWithOwner | undefined> {
  const { rows } = await db.query<PetRow>(
    'SELECT id, name, birth_date, type_id, owner_id FROM pets WHERE id = $1',
    [id],
  );
  const row = rows[0];
  if (!row) return undefined;
  const owner = await findOwnerById(db, row.owner_id);
  const pet = owner?.pets.find((p) => p.id === id);
  if (!owner || !pet) return undefined;
  return {
    ...pet,
    owner: { id: owner.id, firstName: owner.firstName, lastName: owner.lastName },
  };
}

export async function findPetTypes(db: pg.Pool): Promise<PetType[]> {
  const { rows } = await db.query<PetTypeRow>('SELECT id, name FROM types ORDER BY name');
  return rows.map((r) => ({ id: r.id, name: r.name ?? '' }));
}

export async function findVets(db: pg.Pool): Promise<Vet[]> {
  const vets = await db.query<VetRow>('SELECT id, first_name, last_name FROM vets');
  const specialties = await db.query<SpecialtyRow & { vet_id: number }>(
    `SELECT vs.vet_id, s.id, s.name
     FROM vet_specialties vs JOIN specialties s ON s.id = vs.specialty_id`,
  );
  return sortVets(
    vets.rows.map((v) => ({
      id: v.id,
      firstName: v.first_name ?? '',
      lastName: v.last_name ?? '',
      specialties: sortSpecialtiesByName(
        specialties.rows
          .filter((s) => s.vet_id === v.id)
          .map((s) => ({ id: s.id, name: s.name ?? '' })),
      ),
    })),
  );
}

/** Loads each owner's pets (with type name) and each pet's visits, then sorts them like legacy. */
async function withPets(db: pg.Pool, owners: readonly OwnerRow[]): Promise<Owner[]> {
  if (owners.length === 0) return [];
  const ownerIds = owners.map((o) => o.id);
  const pets = await db.query<PetRow & { type_name: string | null }>(
    `SELECT p.id, p.name, p.birth_date, p.type_id, p.owner_id, t.name AS type_name
     FROM pets p JOIN types t ON t.id = p.type_id
     WHERE p.owner_id = ANY($1::int[])`,
    [ownerIds],
  );
  const visits = await db.query<VisitRow>(
    `SELECT v.id, v.pet_id, v.visit_date, v.description
     FROM visits v JOIN pets p ON p.id = v.pet_id
     WHERE p.owner_id = ANY($1::int[])`,
    [ownerIds],
  );
  return owners.map((o) => ({
    id: o.id,
    firstName: o.first_name ?? '',
    lastName: o.last_name ?? '',
    address: o.address ?? '',
    city: o.city ?? '',
    telephone: o.telephone ?? '',
    pets: sortPetsByName(
      pets.rows
        .filter((p) => p.owner_id === o.id)
        .map((p) => ({
          id: p.id,
          name: p.name ?? '',
          birthDate: p.birth_date,
          type: p.type_name ?? '',
          visits: sortVisitsByDateDesc(
            visits.rows
              .filter((v) => v.pet_id === p.id)
              .map((v) => ({ id: v.id, date: v.visit_date, description: v.description ?? '' })),
          ),
        })),
    ),
  }));
}
