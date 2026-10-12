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
