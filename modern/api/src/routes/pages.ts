// Static assets and SPA page routes [SPEC §1, §3]. Fastify decides the status before the SPA
// loads: a known page pattern serves index.html (200), a known pattern with an id legacy cannot
// bind is 400, and anything else falls through to Fastify's 404. Data misses (an unknown owner)
// stay 200 and are rendered client-side, as legacy does.

import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { join } from 'node:path';
import { parseLegacyId } from '../domain/ids.js';

/**
 * Page patterns mirrored from the legacy controllers. `*` in `/owners/*\/pets/{petId}/visits/new`
 * (VisitController) matches any owner segment, so that route checks only the pet id. The id
 * parameters listed for each route must parse as legacy ids.
 */
export const PAGE_ROUTES: readonly { path: string; ids: readonly string[] }[] = [
  { path: '/', ids: [] },
  { path: '/owners', ids: [] },
  { path: '/owners/find', ids: [] },
  { path: '/owners/new', ids: [] },
  { path: '/owners/:ownerId', ids: ['ownerId'] },
  { path: '/owners/:ownerId/edit', ids: ['ownerId'] },
  { path: '/owners/:ownerId/pets/new', ids: ['ownerId'] },
  { path: '/owners/:ownerId/pets/:petId/edit', ids: ['ownerId', 'petId'] },
  { path: '/owners/:ownerId/pets/:petId/visits/new', ids: ['petId'] },
  { path: '/vets', ids: [] },
  { path: '/oups', ids: [] },
];

export function registerPageRoutes(app: FastifyInstance, webRoot: string): void {
  // Copied legacy assets (`public/resources`) and Vite's hashed bundles. index.html itself is
  // only reachable through a page route: legacy answers 404 for `/index.html`.
  void app.register(fastifyStatic, { root: join(webRoot, 'resources'), prefix: '/resources/' });
  void app.register(fastifyStatic, {
    root: join(webRoot, 'assets'),
    prefix: '/assets/',
    decorateReply: false,
  });

  for (const { path, ids } of PAGE_ROUTES) {
    app.get<{ Params: Record<string, string> }>(path, (req, reply) => {
      const bad = ids.find((name) => parseLegacyId(req.params[name] ?? '') === undefined);
      if (bad !== undefined) return reply.code(400).type('text/plain').send(`Invalid ${bad}`);
      return reply.sendFile('index.html', webRoot);
    });
  }
}
