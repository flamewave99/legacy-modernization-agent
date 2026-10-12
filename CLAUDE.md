# legacy-modernization-agent

Portfolio project: convert a legacy Spring MVC/JSP app (`legacy/`) into a modern TypeScript app (`modern/`) using AI agents, with RAG over the legacy code, an MCP server, and evals.

## Layout
- `legacy/`: original Java app. Read-only; never edit except Docker setup.
- `modern/`: the rewrite. `modern/web` (React + Vite + TypeScript), `modern/api` (Node + Fastify + TypeScript), Postgres.
- `tests/characterization/`: Playwright suite. The source of truth for behavior. Runs against `BASE_URL`.
- `rag/`: indexer, pgvector schema, chat CLI, and eval set.
- `mcp/`: MCP server exposing `search_legacy_code`.
- `SPEC.md`: behavior spec derived from legacy code. `fix_plan.md`: ordered task checklist.

## Rules
- Behavior parity with legacy wins over "improvements". If unsure, check legacy code (use `search_legacy_code` when available).
- Never change a characterization test to make the modern app pass. If a test is wrong about legacy behavior, prove it against legacy first and note it in `NOTES.md`.
- TypeScript strict mode. Small commits with clear messages.
- Commit messages and PR descriptions carry no AI attribution: no `Co-Authored-By` trailers, session links or "Generated with" lines.
- Each loop iteration: one task from `fix_plan.md`, then build, lint, test, commit, tick the task.
- Agents commit on the branch they are given and never push, merge, switch branches or change git config. The host orchestrator (`ralph.sh`) pushes, opens the PR into `migration`, and GitHub merges it only when CI passes.
- Agents never edit `tests/characterization/`, `legacy/`, `docker/`, `.github/`, `.devcontainer/`, `.claude/`, `ralph.sh`, `PROMPT.md` or `CLAUDE.md`, and never remove lines from `modern/ratchet.txt`. CI rejects agent branches that do.
- Record surprises and decisions in `NOTES.md` (it becomes README material).
