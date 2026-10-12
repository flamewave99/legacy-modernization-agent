# NOTES

Decisions and surprises, newest last. Each entry: ID, date, what, why/evidence.
This file becomes README material, and the Ralph loop reads its tail every iteration.

## Phase 1–2 (2026-10-12)

- **N1 Legacy is vendored, not a submodule.**
  - `legacy/` is a plain copy of `spring-petclinic/spring-framework-petclinic` at commit `cf392920cdbe9cd07689f1f4b603271940bac957` (2026-10-05), without its `.git`. Its Apache 2.0 `LICENSE.txt` is kept.
  - Why: a migration works against a frozen snapshot. The RAG indexer and agents need plain files. A submodule would make cloning and indexing clumsier for no benefit, since upstream changes are irrelevant mid-migration.
- **N2 Docker files live outside `legacy/`** (`docker/legacy.Dockerfile`, root `docker-compose.yml`), so the vendored code stays identical to upstream.
- **N3 Tomcat 11, not `mvn jetty:run-war`.**
  - Upstream's Jetty plugin is 11.x (Servlet 5), but Spring Framework 7 needs Servlet 6.1.
  - The image builds the WAR with Maven on Temurin 17 and deploys it as `ROOT.war` on `tomcat:11.0-jdk17-temurin`, so URLs sit at `/`.
- **N4 Legacy DB is H2 in memory**, reseeded on every start. `docker compose restart legacy` gives a clean slate.
- **N5 Playwright on WSL needed system libraries** (`libnspr4` and others).
  - `sudo npx ...` failed because nvm's Node is not on sudo's PATH, and the `!` prompt prefix has no TTY for the password.
  - Fix, in a normal terminal: `sudo ~/.nvm/versions/node/v24.19.0/bin/node node_modules/.bin/playwright install-deps chromium`.
- **N6 Selector contract** (top of `tests/characterization/support/helpers.ts`).
  - Tests find fields by HTTP `name`, buttons/links/headings by visible text, and errors by "innermost element wrapping the field".
  - Never by legacy CSS classes or JSP structure. Legacy labels have no `for=`, so `getByLabel` was not an option.
- **N7 Test isolation.**
  - Each test creates its own owner with a fixed-length random last name (search is a prefix match, so no generated name may be a prefix of another).
  - Seed data is only read.
  - Verified: 3 consecutive runs on a dirty DB, 198/198 passing.
- **N8 Correction: the empty-telephone message is NOT deterministic.**
  - I first recorded "always the digits message" from 4 samples, and one subagent repeated it. 12 identical requests then gave 5× `must not be empty` and 7× `numeric value out of bounds…`.
  - Cause: Hibernate Validator returns violations as an unordered set, and the JSP shows the first.
  - The test accepts either. Modern always shows `must not be empty` (SPEC D9).
- **N9 flatpickr rewrites date inputs.**
  - The server renders `2010/09/07`, but the date widget reformats the value to `2010-09-07` on page load. Legacy also accepts ISO dates, so submitting an unchanged form works.
  - Tests assert what the browser shows (`yyyy-MM-dd`) and that unchanged submits succeed.
  - The views subagent flagged this as a "probable bug". The suite showed it is not one.
- **N10 Null visit date crash needs two visits.**
  - A blank visit date saves NULL. The owner page 500s only once that pet has 2+ visits, because Java's sort skips lists shorter than 2.
  - My first `@legacy-bug` test assumed one visit was enough and failed. The domain subagent had predicted the nuance.
- **N11 Search is case-insensitive only because H2's column type is `VARCHAR_IGNORECASE`.** The JPQL is a plain `LIKE`. Postgres needs `ILIKE` to match.
- **N12 Legacy's own `db/postgresql/data.sql` differs from the H2 seed** (other birth and visit dates, reversed visit order). Modern seeds from the H2 values.
- **N13 `@legacy-bug` tests are excluded by default** (`grepInvert` in `playwright.config.ts`; run them with `INCLUDE_LEGACY_BUGS=1`). They document defects without forcing the rewrite to reproduce crashes. Each fix is listed in SPEC §8.
- **N14 Modern is tested on one origin (port 3000), not the Vite dev server.** Page URLs must return 404/400 where legacy does, and Vite answers everything with 200. `PROMPT.md` was updated from 5173 to 3000.
- **N15 All legacy defects (SPEC §8, D1–D10) are fixed in modern, not reproduced.** Decided 2026-10-12. Each one gets a write-up in `FINDINGS.md` after the migration (fix_plan task 23).
- **N16 License.** MIT for this project's own code (`LICENSE`); `legacy/` stays Apache 2.0.
- **N17 Postgres image is `pgvector/pgvector:pg17`.** It is plain Postgres 17 plus the vector extension, so Phase 4 (RAG) can reuse the same server. Host port 5433 (a local Postgres holds 5432).
- **N18 Ralph sandbox design** (`.devcontainer/`, adapted from Anthropic's reference dev container).
  - Docker Compose overlay: the agent's container joins the network with `legacy` and `db`, and reaches them by service name.
  - No Docker socket. Mounting it would give the agent root-equivalent control of the host.
  - Default-deny iptables firewall. Allowed: the Anthropic API, the npm registry, Claude login and telemetry domains, and the compose subnet. GitHub is deliberately blocked (the reference allows it), so the loop can commit but not push.
  - Verified 2026-10-12: example.com and github.com are blocked; npm, `legacy:8080` and Postgres are reachable; `sudo` is limited to the firewall script; 60/60 characterization tests pass from inside the container.
- **N19 Gotchas hit while building the sandbox.**
  - Relative paths in an overlay compose file resolve from the *first* compose file's directory (the repo root), not the overlay's.
  - Debian login shells reset PATH from `/etc/profile`, which hid the npm-global `claude` binary. Fixed with `/etc/profile.d/npm-global.sh`.
- **N20 GitHub push uses HTTPS with `gh` as the credential helper** (repo-local git config). SSH failed with "Permission denied (publickey)": the host key is not registered with GitHub, or needs a passphrase. The git identity is also set in repo-local config, so commits made inside the container use the same author.
- **N21 The agent never holds GitHub credentials** (decided 2026-10-12).
  - Goal: hands-off merging. Tried first: give the agent a bot token inside the sandbox. Claude Code's own safety check blocked writing that credential setup.
  - Chosen instead: split roles. The agent (sandbox) only edits and commits. The host orchestrator (`ralph.sh`, the human's `gh` login) pushes, opens a PR into `migration` with auto-merge, waits for CI, and feeds failures back through `.ralph/ci-feedback.md`.
  - Same autonomy, smaller blast radius. The sandbox firewall keeps blocking GitHub.
- **N22 Threat model for the shared checkout.** The agent writes to the same working tree the host orchestrator runs git in. Mitigations:
  - The prompt is read from `origin/migration`, not the working tree.
  - `ralph.sh` runs as one function, so bash has parsed it all before any edit could land.
  - Host git runs with `core.hooksPath=/dev/null` and `core.fsmonitor=false`.
  - `.git/config` and `.git/hooks` are mounted read-only in the container. Verified: config and hook writes fail, commits work.
  - The loop stops if protected paths change or the agent leaves the branch or uncommitted work.
- **N23 Merge gate** (`.github/workflows/ci.yml`). Every PR runs:
  - the characterization suite against legacy, including `@legacy-bug` tests;
  - build, lint and unit tests for modern;
  - the **ratchet**: tests listed in `modern/ratchet.txt` must pass against modern, and lines may never be removed.

  Agent branches (`ralph/*`) may not touch tests, CI, sandbox or prompt files. The path guard keys on the branch prefix. It guards against mistakes, not a determined adversary. The real boundary is that the agent cannot push at all.
- **N24 Integration-branch model.**
  - Agent PRs auto-merge into `migration` (squash, linear history, CI required).
  - When a `fix_plan.md` section completes, the orchestrator opens or updates a `migration` → `main` milestone PR. The human reviews and merges it with a merge commit.
  - `main` requires CI but no approval: a solo maintainer cannot approve their own PR, and only humans can act on GitHub anyway.
- **N25 Test seam.** `RALPH_AGENT_CMD` replaces the agent with a scripted command. It was used to test the orchestrator's merge and CI-failure paths without spending model calls.
- **N26 Orchestrator self-test (2026-10-12).** A scripted agent (`RALPH_AGENT_CMD`) broke CI on purpose by adding a `package.json` without a lockfile. CI failed, the failed log reached the next iteration through `.ralph/ci-feedback.md`, and the scripted fix on the same branch passed CI and auto-merged into `migration`.
- **N27 Orchestrator guardrail tests (2026-10-12).**
  - **CI-failure path.** A scripted agent broke CI on PR #2. The failure log reached the next iteration, the fix landed on the same branch, CI passed, and GitHub auto-merged the PR into `migration` about 2.5 minutes later. The orchestrator then removed its state and the remote branch.
  - **Protected path.** A scripted agent edited `tests/characterization/specs/vets.spec.ts`. The loop stopped one second later. Nothing was pushed and no PR was opened.
  - **Branch protection.** A direct push to `migration` was rejected even for the repo admin (`GH006: Protected branch update failed`).
  - **False positive found.** The first run also stopped because of `.claude/scheduled_tasks.lock`, a runtime file Claude Code wrote on the host. Claude Code runtime files are now gitignored.
- **N28 The human's `gh` token has no `workflow` scope during loop runs.** It was granted only to land `.github/workflows/ci.yml`, then removed. GitHub then rejects any orchestrator push that changes a workflow file, so the merge gate cannot be edited from the loop. This backs up the CI path guard with a rule GitHub enforces.
- **N29 Auto-merge lags.** On PR #3, GitHub merged about 3.5 minutes after CI passed (state `CLEAN`, auto-merge enabled). The orchestrator now waits up to 15 minutes for the merge instead of 5.
- **N30 Faster CI** (measured on PRs #1–#4 before the change: about 100s cached, 170s cold).
  - Parallel jobs behind one `ci` gate job, so branch protection still needs a single check.
  - Selective testing: the legacy suite runs only when `legacy/`, `docker/`, the tests, compose or CI change, and always on pushes to `migration`/`main`, nightly and on manual runs.
  - npm and Playwright browser caching.
  - Postgres as a service container.
  - `legacy/` and `docker/` became protected paths, which is what makes skipping the legacy suite on agent PRs safe.
  - At thousands of PRs a day, the next steps would be a merge queue (batching instead of rebase-and-rerun), affected-only builds (Nx/Turborepo), test sharding and larger runners.
