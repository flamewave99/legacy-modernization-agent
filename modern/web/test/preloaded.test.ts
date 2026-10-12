// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { takePreloaded } from '../src/api/preloaded.js';

describe('takePreloaded', () => {
  it('hands out the embedded response once, and only for its path', () => {
    document.head.innerHTML =
      '<script id="preloaded" type="application/json">{"path":"/api/vets","result":{"ok":true,"data":["\\u003c"]}}</script>';
    expect(takePreloaded('/api/owners?lastName=')).toBeUndefined();
    expect(takePreloaded('/api/vets')).toEqual({ ok: true, data: ['<'] });
    expect(takePreloaded('/api/vets')).toBeUndefined();
  });
});
