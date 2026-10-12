// Indexes legacy/src and legacy/pom.xml: chunk, embed, and replace this model's rows in pgvector.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chunkFile } from './chunker.js';
import { config, REPO_ROOT } from './config.js';
import { ensureDatabase, ensureSchema, replaceChunks, withClient } from './db.js';
import { defaultEmbedder } from './retrieve.js';

const SOURCE = /\.(java|jsp|tag|xml|sql|properties)$/;

const files = [
  ...readdirSync(join(REPO_ROOT, 'legacy/src'), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && SOURCE.test(d.name))
    .map((d) => relative(REPO_ROOT, join(d.parentPath, d.name))),
  'legacy/pom.xml',
].sort();

const chunks = files.flatMap((f) => chunkFile(f, readFileSync(join(REPO_ROOT, f), 'utf8')));
const embedder = defaultEmbedder();
const started = Date.now();
const vectors = await embedder.embedDocuments(chunks.map((c) => c.text));

await ensureDatabase(config.databaseUrl);
await withClient(config.databaseUrl, async (client) => {
  await ensureSchema(client);
  await replaceChunks(client, embedder.model, chunks, vectors);
});

const byKind = Object.entries(Object.groupBy(chunks, (c) => c.kind)).map(([k, v]) => `${k}=${v?.length ?? 0}`);
console.log(
  `Indexed ${files.length} files as ${chunks.length} chunks with ${embedder.model} ` +
    `(${vectors[0]?.length ?? 0} dims) in ${((Date.now() - started) / 1000).toFixed(1)}s: ${byKind.join(', ')}`,
);
