import { bm25Search, loadBm25Index, queryTerms } from './bm25.js';
import { config } from './config.js';
import { fuse, search, withClient, type SearchHit } from './db.js';
import { OllamaEmbedder, type Embedder } from './embed.js';

export function defaultEmbedder(): Embedder {
  return new OllamaEmbedder(config.embedModel, config.ollamaUrl);
}

/** Top-k chunks for a natural-language question. Shared by the CLIs and the MCP server. */
export async function retrieve(question: string, k = 5, embedder: Embedder = defaultEmbedder()): Promise<SearchHit[]> {
  const vector = await embedder.embedQuery(question);
  return withClient(config.databaseUrl, async (client) => {
    if (config.strategy === 'vector') return search(client, embedder.model, vector, k);
    const index = await loadBm25Index(client, embedder.model);
    return fuse([await search(client, embedder.model, vector, 50), bm25Search(index, await queryTerms(client, question), 50)], k);
  });
}

export function formatHit(hit: SearchHit, rank: number): string {
  const where = `${hit.path}:${hit.startLine}-${hit.endLine}`;
  return `${rank}. [${hit.score.toFixed(3)}] ${where}${hit.symbol ? `  (${hit.symbol})` : ''}`;
}
