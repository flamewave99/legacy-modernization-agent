# rag: retrieval over the legacy code

Semantic search over `legacy/` so humans and agents can ask "where is X handled?" and get file:line answers.

| Piece | File | What it does |
|---|---|---|
| Chunker | `src/chunker.ts` | Java: one chunk per method (with its javadoc and annotations), plus a condensed type chunk (declaration, fields, method pointers). JSP, XML, SQL, properties: whole file, or 80-line windows with 20 lines of overlap when longer than 150 lines. Each chunk starts with a `// File:` / `// Symbol:` header. |
| Embeddings | `src/embed.ts` | Local `nomic-embed-text` (768 dims) served by Ollama, using the task prefixes the model was trained with (`search_document:` / `search_query:`). |
| Store | `db/schema.sql`, `src/db.ts` | pgvector in the `rag` database. One row per chunk per model, so models can be compared side by side. Exact cosine search; a few hundred rows need no ANN index. |
| CLIs | `src/search-cli.ts`, `src/ask-cli.ts` | `search` lists the top-k chunks. `ask` passes them to headless Claude Code with all tools disabled, so answers come only from the retrieved excerpts, with file:line citations. |

## Run

```bash
docker compose up -d db ollama
docker compose exec ollama ollama pull nomic-embed-text   # once
cd rag && npm install
npm run index                                             # ~1.5 min on CPU: 102 files -> 325 chunks
npm run search -- "what happens when a search finds exactly one owner?"
npm run ask -- "how are duplicate pet names rejected?"
npm test                                                  # chunker unit tests
```

Config (env): `RAG_DATABASE_URL` (default `postgres://petclinic:petclinic@localhost:5433/rag`), `OLLAMA_URL` (default `http://localhost:11434`), `RAG_EMBED_MODEL` (default `nomic-embed-text`).

## Eval (Phase 6)

`npm run eval` scores retrieval on 22 development questions (`eval/questions.json`), each with the legacy files that answer it. `npm run eval -- --holdout <strategies>` runs 12 held-out questions (`eval/questions-holdout.json`), written after the development results were seen and run once. Full per-question ranks are in `eval/RESULTS.md` and `eval/RESULTS-holdout.md`.

Development set (22 questions; a hit is a chunk from an expected file):

| Strategy | hit@1 | hit@5 | MRR@10 |
|---|---|---|---|
| keyword, Postgres `ts_rank` | 5 (23%) | 14 (64%) | 0.39 |
| keyword, BM25 | 10 (45%) | 16 (73%) | 0.60 |
| vector, `mxbai-embed-large` (1024 dims) | 14 (64%) | 16 (73%) | 0.67 |
| **vector, `nomic-embed-text` (768 dims, default)** | 15 (68%) | 19 (86%) | 0.76 |
| hybrid, `ts_rank` + nomic | 10 (45%) | 16 (73%) | 0.56 |
| **hybrid, BM25 + nomic** | 15 (68%) | 21 (95%) | 0.78 |

Held-out set (12 questions, the two finalists only):

| Strategy | hit@1 | hit@5 | MRR@10 |
|---|---|---|---|
| vector, nomic | 6 (50%) | 12 (100%) | 0.72 |
| hybrid, BM25 + nomic | 8 (67%) | 11 (92%) | 0.77 |

What the numbers say:
- **Keyword search needs IDF.** Postgres `ts_rank` counts a word that appears in nearly every chunk ("owner", "pet") as much as a rare one. Hybrid search built on it was *worse* than vectors alone. BM25 (`src/bm25.ts`, textbook k1=1.2 and b=0.75, Postgres's English stemmer) doubled keyword hit@1 and made hybrid search helpful.
- **The bigger embedding model was worse.** `mxbai-embed-large` is 2.5x larger and lost to `nomic-embed-text` on this codebase. Only measuring shows that.
- **Hybrid fixes the vocabulary misses.** "Where are owner fields validated?" (the code says `@NotEmpty`, never "validation") goes from not found to rank 3.
- **It is not a clear overall winner.** Across all 34 questions hybrid ranks the right file first 23 times vs 21, and finds it in the top 5 32 vs 31 times. One question is 3 to 8 points here, so that is within noise.

Decision: hybrid ships as a flag, `RAG_STRATEGY=hybrid`. The default stays `vector` (current behavior) until there is more evidence, for example logged queries from the loop's agent. With hybrid, the reported score is the RRF fusion score, so only the order is meaningful.
