import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { preloadTag } from '../src/routes/pages.js';
import { resetDatabase } from '../src/reset.js';

// A stand-in for modern/web/dist, so these tests do not depend on the web build.
const webRoot = mkdtempSync(join(tmpdir(), 'petclinic-web-'));
mkdirSync(join(webRoot, 'resources', 'css'), { recursive: true });
mkdirSync(join(webRoot, 'assets'));
writeFileSync(join(webRoot, 'index.html'), '<!doctype html><head><title>spa</title></head>');
writeFileSync(join(webRoot, 'resources', 'css', 'petclinic.css'), 'body {}');
writeFileSync(join(webRoot, 'assets', 'index-abc.js'), 'void 0;');

describe('page routes and static assets', () => {
  const app = buildApp({ logger: false, webRoot });
  // The preloaded bodies are checked against the seed, which other files' writes change.
  beforeAll(() => resetDatabase(app.config.databaseUrl));
  afterAll(async () => {
    await app.close();
    rmSync(webRoot, { recursive: true, force: true });
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  // Statuses probed on the running legacy app.
  it.each([
    '/',
    '/owners',
    '/owners?lastName=Davis',
    '/owners?lastName=zzz',
    '/owners/find',
    '/owners/new',
    '/owners/1',
    '/owners/999999',
    '/owners/+1',
    '/owners/1/edit',
    '/owners/1/pets/new',
    '/owners/1/pets/1/edit',
    '/owners/1/pets/1/visits/new',
    '/owners/abc/pets/1/visits/new',
    '/vets',
    '/oups',
  ])('%s serves index.html with 200', async (url) => {
    const res = await get(url);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.body).toContain('<title>spa</title>');
  });

  it.each([
    '/owners/abc',
    '/owners/%20',
    '/owners/abc/edit',
    '/owners/abc/pets/new',
    '/owners/1/pets/abc/edit',
    '/owners/abc/pets/1/edit',
    '/owners/1/pets/abc/visits/new',
  ])('%s returns 400', async (url) => {
    expect((await get(url)).statusCode).toBe(400);
  });

  it.each([
    '/no-such-page',
    '/owners/1/',
    '/vets/',
    '/owners/1/pets',
    '/owners/1/pets/1/visits',
    '/index.html',
    '/resources/nope.css',
  ])('%s returns 404', async (url) => {
    expect((await get(url)).statusCode).toBe(404);
  });

  it('redirects a search with exactly one match to that owner', async () => {
    const res = await get('/owners?lastName=frank');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/owners/1');
  });

  // The SPA reads these with `takePreloaded`, keyed by the API path it would fetch.
  const preloaded = (body: string): unknown => {
    const json = /<script id="preloaded" type="application\/json">(.*?)<\/script><\/head>/.exec(
      body,
    )?.[1];
    return json === undefined ? undefined : JSON.parse(json);
  };

  it.each([
    ['/owners', '/api/owners?lastName=', 10],
    ['/owners?lastName=Davis', '/api/owners?lastName=Davis', 2],
    ['/owners?lastName=a+b&lastName=c', '/api/owners?lastName=a+b%2Cc', 0],
    ['/vets', '/api/vets', 6],
  ])('%s embeds the response of %s', async (url, path, length) => {
    const res = await get(url);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(preloaded(res.body)).toMatchObject({ path, result: { ok: true } });
    expect((preloaded(res.body) as { result: { data: unknown[] } }).result.data).toHaveLength(
      length,
    );
  });

  it('embeds an owner, and the 404 of an unknown one', async () => {
    expect(preloaded((await get('/owners/+1')).body)).toMatchObject({
      path: '/api/owners/%2B1',
      result: { ok: true, data: { id: 1, firstName: 'George' } },
    });
    expect(preloaded((await get('/owners/999999')).body)).toEqual({
      path: '/api/owners/999999',
      result: { ok: false, error: 'Owner 999999 not found' },
    });
  });

  it('the owner edit form embeds the owner it pre-fills', async () => {
    expect(preloaded((await get('/owners/1/edit')).body)).toMatchObject({
      path: '/api/owners/1',
      result: { ok: true, data: { id: 1, firstName: 'George' } },
    });
  });

  it('pages without data embed nothing', async () => {
    expect(preloaded((await get('/owners/find')).body)).toBeUndefined();
  });

  it('escapes < so data cannot close the script element', () => {
    expect(preloadTag('/x', { s: '</script><b>' })).toBe(
      '<script id="preloaded" type="application/json">{"path":"/x","result":{"s":"\\u003c/script>\\u003cb>"}}</script>',
    );
  });

  it('serves copied legacy resources and built assets', async () => {
    const css = await get('/resources/css/petclinic.css');
    expect(css.statusCode).toBe(200);
    expect(css.headers['content-type']).toMatch(/^text\/css/);
    expect((await get('/assets/index-abc.js')).statusCode).toBe(200);
  });
});
