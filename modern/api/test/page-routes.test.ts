import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

// A stand-in for modern/web/dist, so these tests do not depend on the web build.
const webRoot = mkdtempSync(join(tmpdir(), 'petclinic-web-'));
mkdirSync(join(webRoot, 'resources', 'css'), { recursive: true });
mkdirSync(join(webRoot, 'assets'));
writeFileSync(join(webRoot, 'index.html'), '<!doctype html><title>spa</title>');
writeFileSync(join(webRoot, 'resources', 'css', 'petclinic.css'), 'body {}');
writeFileSync(join(webRoot, 'assets', 'index-abc.js'), 'void 0;');

describe('page routes and static assets', () => {
  const app = buildApp({ logger: false, webRoot });
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

  it('serves copied legacy resources and built assets', async () => {
    const css = await get('/resources/css/petclinic.css');
    expect(css.statusCode).toBe(200);
    expect(css.headers['content-type']).toMatch(/^text\/css/);
    expect((await get('/assets/index-abc.js')).statusCode).toBe(200);
  });
});
