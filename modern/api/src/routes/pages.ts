// Static assets and SPA page routes [SPEC §1, §3]. Fastify decides the status before the SPA
// loads: a known page pattern serves index.html (200), a known pattern with an id legacy cannot
// bind is 400, and anything else falls through to Fastify's 404. Data misses (an unknown owner)
// stay 200 and are rendered client-side, as legacy does.
//
// A JSP page is complete when the browser fires `load`; an SPA that fetches after start-up is
// not, and the suite reads some pages without waiting (`allInnerTexts()` right after `goto`). So a
// page route that shows data runs the API request its page would make, via `app.inject`, and
// embeds the response in index.html; the SPA renders it synchronously on start-up.

import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseLegacyId } from '../domain/ids.js';

type Params = Record<string, string>;
type Query = Record<string, string | string[] | undefined>;

/** Mirrors the SPA's `ownersSearchApi`: repeated `lastName`s join with commas, as Spring binds. */
export function ownersSearchApi(query: Query): string {
  const raw = query.lastName;
  const lastName = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  return `/api/owners?${new URLSearchParams({ lastName }).toString()}`;
}

const ownerApi = (p: Params) => `/api/owners/${encodeURIComponent(p.ownerId ?? '')}`;

/**
 * Page patterns mirrored from the legacy controllers. `*` in `/owners/*\/pets/{petId}/visits/new`
 * (VisitController) matches any owner segment, so that route checks only the pet id. The id
 * parameters listed for each route must parse as legacy ids.
 */
export const PAGE_ROUTES: readonly {
  path: string;
  ids: readonly string[];
  /** The API path the page fetches first, built exactly as the SPA builds it. */
  api?: (params: Params, query: Query) => string;
}[] = [
  { path: '/', ids: [] },
  { path: '/owners', ids: [], api: (_, query) => ownersSearchApi(query) },
  { path: '/owners/find', ids: [] },
  { path: '/owners/new', ids: [] },
  { path: '/owners/:ownerId', ids: ['ownerId'], api: ownerApi },
  { path: '/owners/:ownerId/edit', ids: ['ownerId'], api: ownerApi },
  { path: '/owners/:ownerId/pets/new', ids: ['ownerId'] },
  { path: '/owners/:ownerId/pets/:petId/edit', ids: ['ownerId', 'petId'] },
  {
    path: '/owners/:ownerId/pets/:petId/visits/new',
    ids: ['petId'],
    api: (p) => `/api/pets/${encodeURIComponent(p.petId ?? '')}`,
  },
  { path: '/vets', ids: [], api: () => '/api/vets' },
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

  for (const { path, ids, api } of PAGE_ROUTES) {
    app.get<{ Params: Params; Querystring: Query }>(path, async (req, reply) => {
      const bad = ids.find((name) => parseLegacyId(req.params[name] ?? '') === undefined);
      if (bad !== undefined) return reply.code(400).type('text/plain').send(`Invalid ${bad}`);
      if (api === undefined) return reply.sendFile('index.html', webRoot);

      const apiPath = api(req.params, req.query);
      const res = await app.inject({ method: 'GET', url: apiPath });
      const body: unknown = res.json();
      // OwnerController.processFindForm redirects when exactly one owner matches [SPEC §5.1].
      if (path === '/owners' && Array.isArray(body) && body.length === 1) {
        const [only] = body as { id: number }[];
        return reply.redirect(`/owners/${String(only?.id)}`);
      }
      const result =
        res.statusCode === 200
          ? { ok: true, data: body }
          : res.statusCode === 404
            ? { ok: false, error: (body as { error: string }).error }
            : undefined;
      const html = await readFile(join(webRoot, 'index.html'), 'utf8');
      if (result === undefined) return reply.type('text/html; charset=utf-8').send(html);
      return reply
        .type('text/html; charset=utf-8')
        .send(html.replace('</head>', `${preloadTag(apiPath, result)}</head>`));
    });
  }
}

/** The SPA's `takePreloaded` reads this. `<` is escaped so no value can close the script. */
export function preloadTag(path: string, result: unknown): string {
  const json = JSON.stringify({ path, result }).replace(/</g, '\\u003c');
  return `<script id="preloaded" type="application/json">${json}</script>`;
}
