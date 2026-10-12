// MCP server exposing semantic search over the legacy PetClinic code (stdio transport).
// stdout carries the MCP protocol, so diagnostics go to stderr only.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { retrieve } from '../../rag/src/retrieve.js';
import type { SearchHit } from '../../rag/src/db.js';

const DESCRIPTION = [
  'Semantic search over the legacy Spring MVC/JSP PetClinic app in legacy/: Java controllers, models,',
  'validators, repositories, JSP views and tags, Spring XML config, SQL schema and seed data, and the',
  'legacy unit tests. Use it before reimplementing a behavior to find how the legacy app does it, e.g.',
  '"how are duplicate pet names rejected", "what does the find-owners search do with one result",',
  '"which view renders the vet list". Returns the best-matching chunks with file:line ranges and code.',
  'Matches are by meaning, not exact text: confirm by reading the cited lines, and use grep instead',
  'when you already know an exact identifier.',
].join(' ');

// Claude Code hands the model structuredContent instead of the text content when a tool declares an
// outputSchema, so the code itself must be in the structured hits, not only in the text block.
const hitSchema = z.object({
  path: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  symbol: z.string().nullable(),
  kind: z.string(),
  score: z.number(),
  code: z.string(),
});

const languageFor = (path: string): string =>
  path.endsWith('.java') ? 'java' : path.endsWith('.xml') ? 'xml' : path.endsWith('.sql') ? 'sql' : path.endsWith('.jsp') || path.endsWith('.tag') ? 'jsp' : '';

export function formatResults(query: string, hits: SearchHit[]): string {
  if (hits.length === 0) return `No legacy code matched "${query}".`;
  return hits
    .map((h, i) => {
      const title = `### ${i + 1}. ${h.path}:${h.startLine}-${h.endLine}${h.symbol ? ` (${h.symbol})` : ''}, score ${h.score.toFixed(3)}`;
      return `${title}\n\`\`\`${languageFor(h.path)}\n${h.content}\n\`\`\``;
    })
    .join('\n\n');
}

export function createServer(search: typeof retrieve = retrieve): McpServer {
  const server = new McpServer({ name: 'legacy-code', version: '1.0.0' });
  server.registerTool(
    'search_legacy_code',
    {
      title: 'Search legacy code',
      description: DESCRIPTION,
      inputSchema: {
        query: z.string().min(3).describe('What you want to find, in plain language or with identifiers.'),
        k: z.number().int().min(1).max(20).default(5).describe('How many chunks to return (default 5).'),
      },
      outputSchema: { hits: z.array(hitSchema) },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, k }) => {
      try {
        const hits = await search(query, k);
        return {
          content: [{ type: 'text', text: formatResults(query, hits) }],
          structuredContent: {
            hits: hits.map(({ path, startLine, endLine, symbol, kind, score, content }) => ({ path, startLine, endLine, symbol, kind, score, code: content })),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`search_legacy_code failed: ${message}`);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                `search_legacy_code failed: ${message}. The index may not be built (cd rag && npm run index), ` +
                'or Postgres (RAG_DATABASE_URL) or Ollama (OLLAMA_URL) is unreachable. Fall back to grep over legacy/.',
            },
          ],
        };
      }
    },
  );
  return server;
}

// Run as a stdio server when executed directly (not when imported by tests). Compare URLs, not
// strings: import.meta.url is percent-encoded and symlink-resolved, argv[1] is neither.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  await createServer().connect(new StdioServerTransport());
  console.error('legacy-code MCP server ready on stdio');
}
