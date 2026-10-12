import type pg from 'pg';
import type { SearchHit } from './db.js';

/**
 * BM25 over the chunks of one model. Postgres's ts_rank has no inverse document frequency, so a
 * word that appears in almost every chunk ("owner", "pet") counts as much as a rare one; BM25 is the
 * standard fix. Tokens come from Postgres's English text search (stemmed, stop words removed), with
 * paths and camelCase identifiers split into words first. k1 and b are the textbook defaults.
 */
const K1 = 1.2;
const B = 0.75;

// Split paths and camelCase before stemming: "OwnerController.java" -> "Owner Controller java".
const SPLIT = `regexp_replace(regexp_replace(%s, '[/._-]', ' ', 'g'), '([a-z])([A-Z])', '\\1 \\2', 'g')`;

interface Doc {
  hit: Omit<SearchHit, 'score'>;
  tf: Map<string, number>;
  length: number;
}

export interface Bm25Index {
  docs: Doc[];
  df: Map<string, number>;
  avgLength: number;
}

/** Parses tsvector text output: 'lexem':1,4 'other':2A ... -> term frequencies. */
export function parseTsvector(text: string): Map<string, number> {
  const tf = new Map<string, number>();
  for (const m of text.matchAll(/'((?:[^']|'')+)'(?::([\dA-D,]+))?/g)) {
    const term = (m[1] ?? '').replace(/''/g, "'");
    tf.set(term, m[2] ? m[2].split(',').length : 1);
  }
  return tf;
}

export async function loadBm25Index(client: pg.Client, model: string): Promise<Bm25Index> {
  const { rows } = await client.query<{
    path: string; kind: string; symbol: string | null; start_line: number; end_line: number; content: string; lexemes: string;
  }>(
    `SELECT path, kind, symbol, start_line, end_line, content,
            to_tsvector('english', ${SPLIT.replace('%s', 'content')})::text AS lexemes
       FROM chunks WHERE model = $1`,
    [model],
  );
  const docs = rows.map((r): Doc => {
    const tf = parseTsvector(r.lexemes);
    return {
      hit: { path: r.path, kind: r.kind, symbol: r.symbol, startLine: r.start_line, endLine: r.end_line, content: r.content },
      tf,
      length: [...tf.values()].reduce((a, b) => a + b, 0),
    };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const avgLength = docs.reduce((a, d) => a + d.length, 0) / Math.max(docs.length, 1);
  return { docs, df, avgLength };
}

export async function queryTerms(client: pg.Client, question: string): Promise<string[]> {
  const { rows } = await client.query<{ lexemes: string }>(
    `SELECT to_tsvector('english', ${SPLIT.replace('%s', '$1')})::text AS lexemes`,
    [question],
  );
  return [...parseTsvector(rows[0]?.lexemes ?? '').keys()];
}

export function bm25Search(index: Bm25Index, terms: string[], k: number): SearchHit[] {
  const n = index.docs.length;
  const scored = index.docs.map((d) => {
    let score = 0;
    for (const term of terms) {
      const tf = d.tf.get(term);
      if (!tf) continue;
      const df = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.length) / index.avgLength));
    }
    return { ...d.hit, score };
  });
  return scored.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}
