import { describe, expect, it } from 'vitest';
import { bm25Search, parseTsvector, type Bm25Index } from './bm25.js';

describe('parseTsvector', () => {
  it('reads lexemes with their position counts', () => {
    expect([...parseTsvector("'find':3 'owner':1,4,9 'o''brien':2")]).toEqual([['find', 1], ['owner', 3], ["o'brien", 1]]);
  });
});

describe('bm25Search', () => {
  const doc = (path: string, terms: Record<string, number>) => ({
    hit: { path, kind: 'java-method', symbol: null, startLine: 1, endLine: 1, content: '' },
    tf: new Map(Object.entries(terms)),
    length: Object.values(terms).reduce((a, b) => a + b, 0),
  });
  const docs = [
    doc('a', { owner: 3, pet: 2 }),
    doc('b', { owner: 1, valid: 1 }),
    doc('c', { owner: 2, pet: 1 }),
    doc('d', { pet: 1 }),
  ];
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const index: Bm25Index = { docs, df, avgLength: docs.reduce((a, d) => a + d.length, 0) / docs.length };

  it('ranks a rare matching term above a common one', () => {
    expect(bm25Search(index, ['owner', 'valid'], 4)[0]?.path).toBe('b');
  });

  it('returns only documents that match at least one term', () => {
    expect(bm25Search(index, ['valid'], 4).map((h) => h.path)).toEqual(['b']);
  });
});
