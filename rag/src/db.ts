import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { Chunk } from './chunker.js';

export interface SearchHit {
  path: string;
  kind: string;
  symbol: string | null;
  startLine: number;
  endLine: number;
  content: string;
  score: number; // cosine similarity, 1 = identical direction
}

const toVector = (v: number[]): string => `[${v.join(',')}]`;

export async function withClient<T>(databaseUrl: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Creates the index database if it is missing (fresh volumes, new clones, CI). */
export async function ensureDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  await withClient(url.toString(), async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount === 0) await client.query(`CREATE DATABASE ${pg.escapeIdentifier(name)}`);
  });
}

export async function ensureSchema(client: pg.Client): Promise<void> {
  await client.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
}

/** Replaces every chunk of one model in a single transaction, so searches never see a half index. */
export async function replaceChunks(client: pg.Client, model: string, chunks: Chunk[], vectors: number[][]): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM chunks WHERE model = $1', [model]);
    for (const [i, c] of chunks.entries()) {
      await client.query(
        `INSERT INTO chunks (model, path, kind, symbol, start_line, end_line, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
        [model, c.path, c.kind, c.symbol, c.startLine, c.endLine, c.text, toVector(vectors[i] ?? [])],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Full-text keyword search over the same chunks. Paths and camelCase identifiers are split into
 * words first ("processFindForm" -> "process Find Form"), and the question's words are OR-ed, so
 * any shared term can match and ts_rank_cd orders by how many and how close.
 */
export async function keywordSearch(client: pg.Client, model: string, question: string, k: number): Promise<SearchHit[]> {
  const terms = [...new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])];
  if (terms.length === 0) return [];
  const { rows } = await client.query<{
    path: string; kind: string; symbol: string | null; start_line: number; end_line: number; content: string; score: number;
  }>(
    `WITH docs AS (
       SELECT path, kind, symbol, start_line, end_line, content,
              to_tsvector('english', regexp_replace(regexp_replace(content, '[/._-]', ' ', 'g'), '([a-z])([A-Z])', '\\1 \\2', 'g')) AS doc
         FROM chunks WHERE model = $2),
     q AS (SELECT to_tsquery('english', $1) AS query)
     SELECT path, kind, symbol, start_line, end_line, content, ts_rank_cd(doc, q.query) AS score
       FROM docs, q WHERE doc @@ q.query ORDER BY score DESC LIMIT $3`,
    [terms.join(' | '), model, k],
  );
  return rows.map((r) => ({
    path: r.path, kind: r.kind, symbol: r.symbol, startLine: r.start_line, endLine: r.end_line, content: r.content, score: Number(r.score),
  }));
}

/** Reciprocal Rank Fusion: each list contributes 1 / (60 + rank); 60 is the constant from the original RRF paper. */
export function fuse(lists: SearchHit[][], k: number): SearchHit[] {
  const scores = new Map<string, { hit: SearchHit; score: number }>();
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const key = `${hit.path}:${hit.startLine}`;
      const entry = scores.get(key) ?? { hit, score: 0 };
      entry.score += 1 / (60 + rank + 1);
      scores.set(key, entry);
    });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, k).map(({ hit, score }) => ({ ...hit, score }));
}

export async function search(client: pg.Client, model: string, query: number[], k: number): Promise<SearchHit[]> {
  const { rows } = await client.query<{
    path: string; kind: string; symbol: string | null; start_line: number; end_line: number; content: string; score: number;
  }>(
    `SELECT path, kind, symbol, start_line, end_line, content, 1 - (embedding <=> $1::vector) AS score
       FROM chunks WHERE model = $2 ORDER BY embedding <=> $1::vector LIMIT $3`,
    [toVector(query), model, k],
  );
  return rows.map((r) => ({
    path: r.path, kind: r.kind, symbol: r.symbol, startLine: r.start_line, endLine: r.end_line, content: r.content, score: Number(r.score),
  }));
}
