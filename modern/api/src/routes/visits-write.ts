// Visit write endpoint [fix_plan task 13]. Legacy loads the pet in a @ModelAttribute before it
// binds the visit, so an unknown pet is 404 even with a bad body. The owner id is only parsed, never
// checked against the pet (D8: lenient, as legacy). A blank date is `is required` (D1 fix).

import type { FastifyInstance } from 'fastify';
import { formatIsoDate } from '../domain/dates.js';
import { parseLegacyId } from '../domain/ids.js';
import { validateVisit, type VisitInput } from '../domain/visit.js';
import { petExists } from '../queries.js';
import { insertVisit } from '../writes.js';
import { badId, invalid, notFound } from './replies.js';

interface VisitParams {
  ownerId: string;
  petId: string;
}

export function registerVisitWriteRoutes(app: FastifyInstance): void {
  app.post<{ Params: VisitParams; Body: unknown }>(
    '/api/owners/:ownerId/pets/:petId/visits',
    async (req, reply) => {
      if (parseLegacyId(req.params.ownerId) === undefined) return badId(reply, 'ownerId');
      const petId = parseLegacyId(req.params.petId);
      if (petId === undefined) return badId(reply, 'petId');
      if (!(await petExists(app.db, petId))) {
        return notFound(reply, `Pet ${String(petId)} not found`);
      }
      const input = toVisitInput(req.body);
      const result = validateVisit(input);
      if (!result.ok) return invalid(reply, result.errors);
      const id = await insertVisit(app.db, petId, {
        date: formatIsoDate(result.date),
        description: input.description ?? '',
      });
      return reply.code(201).send({ id });
    },
  );
}

/** Only string fields count; anything else is treated as absent. */
function toVisitInput(body: unknown): VisitInput {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const field = (name: keyof VisitInput): string | undefined => {
    const value = source[name];
    return typeof value === 'string' ? value : undefined;
  };
  return { date: field('date'), description: field('description') };
}
