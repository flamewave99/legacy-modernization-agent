/** Turns text into vectors. One implementation per provider; Phase 6 adds a hosted one to compare. */
export interface Embedder {
  readonly model: string;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

/**
 * Local embeddings through an Ollama server. nomic-embed-text was trained with task prefixes, and
 * retrieval quality drops without them: documents get "search_document: ", queries "search_query: ".
 */
export class OllamaEmbedder implements Embedder {
  constructor(
    readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 32) {
      out.push(...(await this.embed(texts.slice(i, i + 32).map((t) => this.prefix('search_document: ', t)))));
    }
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embed([this.prefix('search_query: ', text)]);
    if (!vector) throw new Error('Ollama returned no embedding');
    return vector;
  }

  private prefix(prefix: string, text: string): string {
    return this.model.startsWith('nomic-embed') ? prefix + text : text;
  }

  private async embed(input: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { embeddings: number[][] };
    return body.embeddings;
  }
}
