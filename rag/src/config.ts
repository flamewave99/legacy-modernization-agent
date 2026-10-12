import { fileURLToPath } from 'node:url';

/** Repository root (this file is rag/src/config.ts). */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const config = {
  databaseUrl: process.env.RAG_DATABASE_URL ?? 'postgres://petclinic:petclinic@localhost:5433/rag',
  ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  embedModel: process.env.RAG_EMBED_MODEL ?? 'nomic-embed-text',
  // "vector" (default, current behavior) or "hybrid" (vector + BM25, fused with RRF). See
  // eval/RESULTS*.md: hybrid ranks the right file first slightly more often, but over 34 questions
  // the difference is within noise, so the default stays until more evidence is in.
  strategy: process.env.RAG_STRATEGY === 'hybrid' ? ('hybrid' as const) : ('vector' as const),
};
