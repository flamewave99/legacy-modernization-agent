// Pet write endpoints [fix_plan task 12]. Legacy resolves the owner (@ModelAttribute) before it
// binds the pet, so an unknown owner is 404 even with a bad body; an unknown pet under a known
// owner is checked after validation, as legacy's UPDATE silently changes 0 rows. Only the path
// ids count: any id in the body is ignored (D7 fix), and the type is given by name (D5 fix).

import type { FastifyInstance } from 'fastify';
import { formatIsoDate } from '../domain/dates.js';
import { parseLegacyId } from '../domain/ids.js';
import { validatePet, type PetInput } from '../domain/pet.js';
import { findOwnerById, findPetTypes, type Owner } from '../queries.js';
import { insertPet, updatePet, type PetFields } from '../writes.js';
import { badId, invalid, notFound } from './replies.js';

interface OwnerParams {
  ownerId: string;
}

interface PetParams extends OwnerParams {
  petId: string;
}

export function registerPetWriteRoutes(app: FastifyInstance): void {
  app.post<{ Params: OwnerParams; Body: unknown }>(
    '/api/owners/:ownerId/pets',
    async (req, reply) => {
      const ownerId = parseLegacyId(req.params.ownerId);
      if (ownerId === undefined) return badId(reply, 'ownerId');
      const owner = await findOwnerById(app.db, ownerId);
      if (!owner) return notFound(reply, ownerNotFound(ownerId));
      const fields = await validated(req.body, owner, true);
      if ('errors' in fields) return invalid(reply, fields.errors);
      const id = await insertPet(app.db, ownerId, fields);
      return reply.code(201).send({ id });
    },
  );

  app.put<{ Params: PetParams; Body: unknown }>(
    '/api/owners/:ownerId/pets/:petId',
    async (req, reply) => {
      const ownerId = parseLegacyId(req.params.ownerId);
      if (ownerId === undefined) return badId(reply, 'ownerId');
      const petId = parseLegacyId(req.params.petId);
      if (petId === undefined) return badId(reply, 'petId');
      const owner = await findOwnerById(app.db, ownerId);
      if (!owner) return notFound(reply, ownerNotFound(ownerId));
      const fields = await validated(req.body, owner, false);
      if ('errors' in fields) return invalid(reply, fields.errors);
      if (!(await updatePet(app.db, ownerId, petId, fields))) {
        return notFound(reply, `Pet ${String(petId)} not found for owner ${String(ownerId)}`);
      }
      return reply.code(204).send();
    },
  );

  async function validated(
    body: unknown,
    owner: Owner,
    isNew: boolean,
  ): Promise<PetFields | { errors: Record<string, string> }> {
    const input = toPetInput(body);
    const types = await findPetTypes(app.db);
    const result = validatePet(input, {
      isNew,
      existingNames: owner.pets.map((p) => p.name),
      typeNames: types.map((t) => t.name),
    });
    if (!result.ok) return { errors: result.errors };
    const type = types.find((t) => t.name === input.type);
    return {
      name: input.name ?? '',
      birthDate: formatIsoDate(result.birthDate),
      typeId: type?.id ?? null,
    };
  }
}

function ownerNotFound(ownerId: number): string {
  return `Owner ${String(ownerId)} not found`;
}

/** Only string fields count; anything else is treated as absent. */
function toPetInput(body: unknown): PetInput {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const field = (name: keyof PetInput): string | undefined => {
    const value = source[name];
    return typeof value === 'string' ? value : undefined;
  };
  return { name: field('name'), birthDate: field('birthDate'), type: field('type') };
}
