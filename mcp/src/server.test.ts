import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, describe, expect, it } from 'vitest';
import type { SearchHit } from '../../rag/src/db.js';
import { createServer } from './server.js';

const fakeHit: SearchHit = {
  path: 'legacy/src/main/java/org/springframework/samples/petclinic/web/OwnerController.java',
  kind: 'java-method',
  symbol: 'OwnerController#processFindForm',
  startLine: 76,
  endLine: 99,
  content: '// File: ...\npublic String processFindForm(...) {}',
  score: 0.71,
};

async function connect(search: Parameters<typeof createServer>[0]): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(search).connect(serverSide);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientSide);
  return client;
}

describe('search_legacy_code (in memory, fake retrieval)', () => {
  it('is listed as a read-only tool with a query parameter', async () => {
    const client = await connect(async () => []);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'search_legacy_code');
    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.inputSchema.required).toEqual(['query']);
  });

  it('returns file:line, symbol and code as text, plus structured hits', async () => {
    let asked: [string, number] | undefined;
    const client = await connect(async (q, k) => {
      asked = [q, k ?? -1];
      return [fakeHit];
    });
    const result = await client.callTool({ name: 'search_legacy_code', arguments: { query: 'one owner found' } });
    expect(asked).toEqual(['one owner found', 5]);
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('OwnerController.java:76-99 (OwnerController#processFindForm), score 0.710');
    expect(text).toContain('```java');
    expect(result.structuredContent).toEqual({
      hits: [{ path: fakeHit.path, startLine: 76, endLine: 99, symbol: 'OwnerController#processFindForm', kind: 'java-method', score: 0.71, code: fakeHit.content }],
    });
  });

  it('reports retrieval failures as a tool error with a fallback hint', async () => {
    const client = await connect(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5433');
    });
    const result = await client.callTool({ name: 'search_legacy_code', arguments: { query: 'anything' } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Fall back to grep');
  });

  it('rejects out-of-range k', async () => {
    const client = await connect(async () => []);
    const result = await client.callTool({ name: 'search_legacy_code', arguments: { query: 'owner', k: 50 } });
    expect(result.isError).toBe(true);
  });
});

// End to end over stdio against the real index. Needs Postgres + Ollama + a built index;
// skipped when they are not reachable.
const ollamaUp = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/version`).then((r) => r.ok, () => false);

describe.skipIf(!ollamaUp)('search_legacy_code (stdio, real index)', () => {
  const client = new Client({ name: 'e2e', version: '1.0.0' });
  afterAll(() => client.close());

  it('finds the find-owners controller method for a plain-language question', async () => {
    await client.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/server.ts'], stderr: 'ignore' }));
    const result = await client.callTool({
      name: 'search_legacy_code',
      arguments: { query: 'what happens when a search finds exactly one owner?', k: 3 },
    });
    const hits = (result.structuredContent as { hits: Array<{ symbol: string | null }> }).hits;
    expect(hits.map((h) => h.symbol)).toContain('OwnerController#processFindForm');
  }, 60_000);
});
