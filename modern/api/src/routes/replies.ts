// Shared error replies: a malformed id is 400 and a missing entity is 404 { error }.

import type { FastifyReply } from 'fastify';

export function badId(reply: FastifyReply, name: string): FastifyReply {
  return reply.code(400).send({ error: `Invalid ${name}` });
}

export function notFound(reply: FastifyReply, error: string): FastifyReply {
  return reply.code(404).send({ error });
}

/** Validation failure: 422 `{ errors: { field: message } }`. */
export function invalid(reply: FastifyReply, errors: Record<string, string>): FastifyReply {
  return reply.code(422).send({ errors });
}
