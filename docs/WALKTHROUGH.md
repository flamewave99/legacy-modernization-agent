# Walkthrough: run it and verify it

About 15 minutes from a fresh clone, most of it image builds and model downloads. Each step says what you should see.

## Prerequisites

- Docker with Compose, Node 24, and Playwright's Chromium system libraries (`npx playwright install-deps chromium`, once).
- Free ports: 8080 (legacy), 3000 (modern), 5433 (Postgres), 11434 (Ollama).
- Claude Code, only for step 6 (MCP) and step 8 (the loop).

## 1. Start both apps

```bash
docker compose up -d --build legacy db modern
docker compose ps        # legacy, db and modern Up; modern and db (healthy)
```

- Legacy (Spring MVC, JSP, Tomcat): http://localhost:8080
- Modern (React, Fastify, Postgres): http://localhost:3000

Open them side by side and do the same things in each: Find owners → search "Davis" (two results, a list) → search "Franklin" (one result, straight to the owner) → Add New Pet → Add Visit → Veterinarians → Error. The pages, texts, validation messages and URLs match. `docker compose logs modern | head -3` shows the empty database being seeded on first start.

## 2. Behavior parity: the same 60 tests against both apps

```bash
cd tests/characterization
npm install && npx playwright install chromium
npm test                                  # 60 passed   (legacy, the default BASE_URL)
BASE_URL=http://localhost:3000 npm test   # 60 passed   (modern)
```

The suite finds elements by visible text and form field names, never by page structure, which is what lets one suite judge a JSP app and a React app. Per-spec numbers: [`PARITY.md`](PARITY.md).

## 3. Legacy defects: where modern deliberately differs

```bash
INCLUDE_LEGACY_BUGS=1 npx playwright test specs/legacy-bugs.spec.ts                                  # legacy: 6 passed
INCLUDE_LEGACY_BUGS=1 BASE_URL=http://localhost:3000 npx playwright test specs/legacy-bugs.spec.ts   # modern: 5 failed, 1 passed
cd ../..
```

The six `@legacy-bug` tests pin defects in the legacy app. Against modern, five fail on purpose because modern fixes them, and the one that passes (D3) is a case where both apps return 404. Playwright exits non-zero on the second command; that is the expected result. Each defect's root cause (file:line) and fix: [`FINDINGS.md`](../FINDINGS.md).

## 4. Modern app checks: lint, build, unit tests

```bash
npm install
npm run lint && npm run build && npm test   # API: 274 passed; web: 36 passed
```

To run from source instead of the container: `docker compose stop modern`, then `npm run db:reset -w modern/api && npm run start -w modern/api` (port 3000).

## 5. Retrieval (RAG) over the legacy code, and its eval gate

```bash
docker compose up -d ollama
docker compose exec ollama ollama pull nomic-embed-text
cd rag && npm install
npm run index        # ~1.5 min on CPU: 102 files -> 325 chunks
npm run search -- "how are duplicate pet names rejected?"   # Owner#getPet, PetController#processCreationForm
npm run eval -- --check keyword:bm25 vector:nomic-embed-text hybrid-bm25:nomic-embed-text
npm run eval -- --holdout --check vector:nomic-embed-text hybrid-bm25:nomic-embed-text
git checkout eval/   # the eval rewrites eval/RESULTS*.md with only the strategies you ran
cd ..
```

Expected: `same:` for every strategy (vector 19/22 and hybrid 21/22 in the top 5; held-out 12/12 and 11/12). The scores are deterministic, so CI fails a pull request that drops below `rag/eval/baseline.json`. `npm run ask -- "<question>"` answers from retrieved excerpts with file:line citations (needs Claude Code). Method and results: [`rag/README.md`](../rag/README.md).

## 6. The MCP server

```bash
cd mcp && npm install && cd ..
claude mcp list      # legacy-code: ... ✔ Connected  (run from the repo root)
```

In Claude Code, ask "use search_legacy_code to find how duplicate pet names are rejected". The tool returns the same chunks as step 5, with file:line ranges.

## 7. The orchestrator's safety paths, offline

```bash
scripts/ralph-selftest.sh    # PASS: usage-limit handling
node scripts/agent-tool-usage.mjs   # only with loop logs in logs/: how the agent read legacy code
```

The self-test runs the real `ralph.sh` against a throwaway clone with a local bare repo as origin and a scripted agent, so nothing reaches GitHub or a model. The live guardrail tests (failing CI, merge conflict, protected-path edit, direct push) are recorded in [`NOTES.md`](../NOTES.md) (N26, N27, N38–N41) and visible as pull requests.

## 8. The loop itself (optional, uses your Claude account)

The migration is finished (`DONE` exists), so `./ralph.sh` stops at once. To see how it worked, read the real runs: the [pull requests from `ralph/*` branches](https://github.com/flamewave99/legacy-modernization-agent/pulls?q=is%3Apr+head%3Aralph), each one task with its CI run, and the animation at the top of the README.

Starting it (for a new plan): `npx @devcontainers/cli up --workspace-folder .`, then log in once with `npx @devcontainers/cli exec --workspace-folder . claude`, then run `./ralph.sh` on the host, never inside the sandbox.

## Clean up

```bash
docker compose down          # add -v to also delete the database and model volumes
```

## Where to look next

The README's ["Where to look"](../README.md#where-to-look) table lists the files that show each idea, and its ["Legacy defects found"](../README.md#legacy-defects-found) table summarizes `FINDINGS.md`.
