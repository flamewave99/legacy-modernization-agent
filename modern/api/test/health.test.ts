import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /api/health', () => {
  const app = buildApp({ logger: false });
  afterAll(() => app.close());

  it('returns status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
