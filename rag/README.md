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

## First observations (2026-10-12, six hand-picked questions, before any tuning)

These are anecdotes, not measurements. The Phase 6 eval replaces them with a hit rate over about 20 questions with expected files.

- **Good:** single-owner redirect (`OwnerController#processFindForm`), vets as JSON (`VetController#showJsonVetList`), error page (`exception.jsp`), duplicate pet names (`Owner#getPet`, `PetController#processCreationForm`).
- **Missed:** "where is owner validation handled?" returned repository code instead of the `@NotEmpty`/`@Digits` annotations on `Owner`/`Person`. The word "validation" never appears in that code, a known weakness of pure vector search.
- **Missed:** "which database is used by default?" ranked the MySQL schema first. The answer is the `H2` profile marked `activeByDefault` in `pom.xml`.
- **Grounding held:** when retrieval missed the controller code for a question, `ask` said the excerpts lacked it instead of inventing an answer.

Ideas to measure later, not apply blindly: hybrid search (vectors plus keyword/BM25), a code-specialized hosted model (Voyage), and a summary chunk per file.
