import { describe, expect, it } from 'vitest';
import { DEFAULT_DATABASE_URL, loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('uses defaults when env is empty', () => {
    expect(loadConfig({})).toEqual({ port: 3000, databaseUrl: DEFAULT_DATABASE_URL });
  });

  it('reads PORT and DATABASE_URL', () => {
    expect(loadConfig({ PORT: '4000', DATABASE_URL: 'postgres://x@db/y' })).toEqual({
      port: 4000,
      databaseUrl: 'postgres://x@db/y',
    });
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('Invalid PORT');
  });
});
