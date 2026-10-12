import { config } from './config.js';
import { search, withClient, type SearchHit } from './db.js';
import { OllamaEmbedder, type Embedder } from './embed.js';

export function defaultEmbedder(): Embedder {
  return new OllamaEmbedder(config.embedModel, config.ollamaUrl);
}

/** Top-k chunks for a natural-language question. Shared by the CLIs, the MCP server and the eval. */
export async function retrieve(question: string, k = 5, embedder: Embedder = defaultEmbedder()): Promise<SearchHit[]> {
  const vector = await embedder.embedQuery(question);
  return withClient(config.databaseUrl, (client) => search(client, embedder.model, vector, k));
}

export function formatHit(hit: SearchHit, rank: number): string {
  const where = `${hit.path}:${hit.startLine}-${hit.endLine}`;
  return `${rank}. [${hit.score.toFixed(3)}] ${where}${hit.symbol ? `  (${hit.symbol})` : ''}`;
}
