import { expect, it } from 'vitest';

it('fails on purpose (orchestrator self-test)', () => {
  expect(1).toBe(2);
});
