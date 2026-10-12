// Write queries. The SQL mirrors legacy's JdbcOwnerRepositoryImpl.save.

import type pg from 'pg';

export interface OwnerFields {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
}

export async function insertOwner(db: pg.Pool, owner: OwnerFields): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO owners (first_name, last_name, address, city, telephone)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [owner.firstName, owner.lastName, owner.address, owner.city, owner.telephone],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('INSERT INTO owners returned no id');
  return id;
}

/** Returns false when no owner has this id (legacy's UPDATE silently changes 0 rows). */
export async function updateOwner(db: pg.Pool, id: number, owner: OwnerFields): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE owners SET first_name = $1, last_name = $2, address = $3, city = $4, telephone = $5
     WHERE id = $6`,
    [owner.firstName, owner.lastName, owner.address, owner.city, owner.telephone, id],
  );
  return rowCount === 1;
}

export interface PetFields {
  name: string;
  /** `yyyy-MM-dd`. */
  birthDate: string;
  /** Null keeps the current type (edit only; legacy's form always sends one). */
  typeId: number | null;
}

export async function insertPet(db: pg.Pool, ownerId: number, pet: PetFields): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [pet.name, pet.birthDate, pet.typeId, ownerId],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('INSERT INTO pets returned no id');
  return id;
}

/**
 * Updates the pet only if it belongs to `ownerId`, so a request can never move a pet to another
 * owner (D7 fix). Returns false when no such pet exists.
 */
export async function updatePet(
  db: pg.Pool,
  ownerId: number,
  petId: number,
  pet: PetFields,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE pets SET name = $1, birth_date = $2, type_id = COALESCE($3, type_id)
     WHERE id = $4 AND owner_id = $5`,
    [pet.name, pet.birthDate, pet.typeId, petId, ownerId],
  );
  return rowCount === 1;
}
