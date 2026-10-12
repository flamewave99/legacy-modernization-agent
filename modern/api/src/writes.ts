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
