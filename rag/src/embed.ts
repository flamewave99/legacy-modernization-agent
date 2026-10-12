/** Turns text into vectors. One implementation per provider; Phase 6 adds a hosted one to compare. */
export interface Embedder {
  readonly model: string;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

/**
 * Local embeddings through an Ollama server. Some models were trained with task prefixes and
 * retrieve worse without them, so each model's documented prefixes are applied here.
 */
const PREFIXES: Record<string, { document: string; query: string }> = {
  'nomic-embed-text': { document: 'search_document: ', query: 'search_query: ' },
  'mxbai-embed-large': { document: '', query: 'Represent this sentence for searching relevant passages: ' },
};

export class OllamaEmbedder implements Embedder {
  constructor(
    readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 32) {
      out.push(...(await this.embed(texts.slice(i, i + 32).map((t) => (PREFIXES[this.model]?.document ?? '') + t))));
    }
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embed([(PREFIXES[this.model]?.query ?? '') + text]);
    if (!vector) throw new Error('Ollama returned no embedding');
    return vector;
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
