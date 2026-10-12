// Read endpoints [fix_plan task 9]. A malformed id is 400 and a missing entity is 404 { error }.

import type { FastifyInstance } from 'fastify';
import { parseLegacyId } from '../domain/ids.js';
import {
  findOwnerById,
  findOwnersByLastName,
  findPetById,
  findPetTypes,
  findVets,
} from '../queries.js';
import { badId, notFound } from './replies.js';

export function registerReadRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { lastName?: string | string[] } }>('/api/owners', async (req) => {
    // Spring binds a repeated parameter to a String by joining the values with commas.
    const raw = req.query.lastName;
    const lastName = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
    return findOwnersByLastName(app.db, lastName);
  });

  app.get<{ Params: { ownerId: string } }>('/api/owners/:ownerId', async (req, reply) => {
    const ownerId = parseLegacyId(req.params.ownerId);
    if (ownerId === undefined) return badId(reply, 'ownerId');
    const owner = await findOwnerById(app.db, ownerId);
    return owner ?? notFound(reply, `Owner ${String(ownerId)} not found`);
  });

  app.get<{ Params: { ownerId: string; petId: string } }>(
    '/api/owners/:ownerId/pets/:petId',
    async (req, reply) => {
      if (parseLegacyId(req.params.ownerId) === undefined) return badId(reply, 'ownerId');
      const petId = parseLegacyId(req.params.petId);
      if (petId === undefined) return badId(reply, 'petId');
      const pet = await findPetById(app.db, petId);
      return pet ?? notFound(reply, `Pet ${String(petId)} not found`);
    },
  );

  // The visit form's pet [SPEC §4.6]: `VisitController` binds `/owners/*/pets/{petId}`, so the
  // page has no owner id to parse and looks the pet up by its id alone.
  app.get<{ Params: { petId: string } }>('/api/pets/:petId', async (req, reply) => {
    const petId = parseLegacyId(req.params.petId);
    if (petId === undefined) return badId(reply, 'petId');
    const pet = await findPetById(app.db, petId);
    return pet ?? notFound(reply, `Pet ${String(petId)} not found`);
  });

  app.get('/api/pettypes', () => findPetTypes(app.db));

  app.get('/api/vets', () => findVets(app.db));
}
