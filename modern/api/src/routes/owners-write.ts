// Owner write endpoints [fix_plan task 11]. Legacy validates before it looks at the id, so a
// bad body on an unknown owner is 422, not 404. Any `id` in the body is ignored, as legacy's
// binder disallows it.

import type { FastifyInstance } from 'fastify';
import { parseLegacyId } from '../domain/ids.js';
import { validateOwner } from '../domain/owner.js';
import { insertOwner, updateOwner, type OwnerFields } from '../writes.js';
import { badId, invalid, notFound } from './replies.js';

export function registerOwnerWriteRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown }>('/api/owners', async (req, reply) => {
    const owner = toOwnerFields(req.body);
    const errors = validateOwner(owner);
    if (Object.keys(errors).length > 0) return invalid(reply, errors);
    const id = await insertOwner(app.db, owner);
    return reply.code(201).send({ id });
  });

  app.put<{ Params: { ownerId: string }; Body: unknown }>(
    '/api/owners/:ownerId',
    async (req, reply) => {
      const ownerId = parseLegacyId(req.params.ownerId);
      if (ownerId === undefined) return badId(reply, 'ownerId');
      const owner = toOwnerFields(req.body);
      const errors = validateOwner(owner);
      if (Object.keys(errors).length > 0) return invalid(reply, errors);
      if (!(await updateOwner(app.db, ownerId, owner))) {
        return notFound(reply, `Owner ${String(ownerId)} not found`);
      }
      return reply.code(204).send();
    },
  );
}

/**
 * Only string fields count. Anything else becomes '', which fails `@NotEmpty` exactly as an
 * absent form field (null) does.
 */
function toOwnerFields(body: unknown): OwnerFields {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const field = (name: keyof OwnerFields): string => {
    const value = source[name];
    return typeof value === 'string' ? value : '';
  };
  return {
    firstName: field('firstName'),
    lastName: field('lastName'),
    address: field('address'),
    city: field('city'),
    telephone: field('telephone'),
  };
}
