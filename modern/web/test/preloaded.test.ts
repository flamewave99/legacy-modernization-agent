// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { preload, takePreloaded } from '../src/api/preloaded.js';

describe('takePreloaded', () => {
  it('hands out the embedded response once, and only for its path', () => {
    document.head.innerHTML =
      '<script id="preloaded" type="application/json">{"path":"/api/vets","result":{"ok":true,"data":["\\u003c"]}}</script>';
    expect(takePreloaded('/api/owners?lastName=')).toBeUndefined();
    expect(takePreloaded('/api/vets')).toEqual({ ok: true, data: ['<'] });
    expect(takePreloaded('/api/vets')).toBeUndefined();
  });

  it('hands out a response seeded by preload once, in place of the embedded one', () => {
    preload('/api/owners/1', { ok: false, error: 'gone' });
    expect(takePreloaded('/api/vets')).toBeUndefined();
    expect(takePreloaded('/api/owners/1')).toEqual({ ok: false, error: 'gone' });
    expect(takePreloaded('/api/owners/1')).toBeUndefined();
  });
});
