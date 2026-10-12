# legacy-modernization-agent

Migrating a legacy Java web app to TypeScript with AI coding agents. The work is gated by characterization tests and planned from a spec the agents derive from the code.

The legacy app is [Spring Framework PetClinic](https://github.com/spring-petclinic/spring-framework-petclinic) (Spring MVC, JSP, XML config, JPA). The target is React + Vite, Fastify and Postgres, with the same routes and behavior.

> **Status:** Phases 1–2 are done: the legacy app is pinned with tests, and the spec and plan are written. The rewrite (Phase 3) has not started.

## How it works

1. **Pin the legacy behavior.** A Playwright suite (`tests/characterization/`) records what the legacy app does today, quirks included. It reads `BASE_URL`, so the same suite later judges the rewrite.
2. **Spec from code.** Four subagents analyzed the legacy code in parallel (routes, domain/schema, views, validation). Their findings were checked against the running app and merged into [`SPEC.md`](SPEC.md).
3. **Plan.** [`fix_plan.md`](fix_plan.md) breaks the rewrite into small ordered tasks.
4. **Ralph loop** (next). [`ralph.sh`](ralph.sh) runs Claude Code headless with [`PROMPT.md`](PROMPT.md), one task per iteration, until the characterization suite passes against the new app.
5. Later phases:
   - RAG over the legacy code (pgvector)
   - an MCP server exposing `search_legacy_code`
   - evals

## Run it

Requirements:
- Docker
- Node 20+
- Playwright's Chromium dependencies (`npx playwright install-deps chromium`)

```bash
docker compose up -d legacy            # legacy app on http://localhost:8080
cd tests/characterization
npm install && npx playwright install chromium
npm test                               # 60 tests against legacy
INCLUDE_LEGACY_BUGS=1 npm test         # also run tests that pin known legacy defects
BASE_URL=http://localhost:3000 npm test   # later: against the modern app
```

## Run the Ralph loop (sandboxed)

The loop runs Claude Code with permission prompts skipped, so it only runs inside the dev container in `.devcontainer/`:
- **Outbound firewall** (default deny). Only the Anthropic API, the npm registry and the compose network (legacy app, Postgres) are reachable. GitHub is blocked, so the agent can commit but not push.
- **No Docker socket** inside the container, so the agent cannot control the host's Docker.
- **Non-root user.** The only sudo rule allows running the firewall script.
- **`ralph.sh` refuses to run outside the container**, and it works on a `ralph/<timestamp>` branch, never on `main`. A human reviews the branch, then pushes and merges it from the host.

```bash
# VS Code: "Dev Containers: Reopen in Container". Or with the CLI:
npx @devcontainers/cli up --workspace-folder .
npx @devcontainers/cli exec --workspace-folder . bash
claude            # first time only: log in, then exit
./ralph.sh        # MAX_ITERATIONS=25 by default
```

## Layout

| Path | What |
|---|---|
| `legacy/` | Vendored upstream app (Apache 2.0), unmodified |
| `docker/`, `docker-compose.yml` | Legacy app and Postgres containers |
| `.devcontainer/` | Sandbox for the Ralph loop (firewall, no Docker socket) |
| `tests/characterization/` | Behavior tests: the source of truth |
| `SPEC.md` | Behavior spec derived from the legacy code |
| `fix_plan.md` | Ordered task list for the rewrite |
| `NOTES.md` | Decisions and surprises |
| `CLAUDE.md`, `PROMPT.md`, `ralph.sh` | Agent rules, loop prompt, loop script |

## License

MIT (see `LICENSE`). The vendored PetClinic code in `legacy/` remains Apache 2.0 (see `legacy/LICENSE.txt`).
