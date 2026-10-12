# fix_plan.md: build `modern/`

One task per Ralph loop iteration, done top to bottom. Each task lists what "done" means.
Behavior details are in `SPEC.md` (section numbers in brackets).

**Where this runs.** Inside the dev container (`.devcontainer/`). There the legacy app is at
`$LEGACY_URL` (http://legacy:8080) and Postgres at `$DATABASE_URL` (host `db`, port 5432). There is
no Docker inside the sandbox, so `docker` commands are not available.

**How work lands.** The agent commits on a `ralph/...` branch. The host orchestrator pushes it and
opens a PR into `migration` with auto-merge. CI (`.github/workflows/ci.yml`) must pass: the
characterization suite against legacy, build, lint and unit tests, and the ratchet against modern.
If CI fails or `migration` starts to conflict, `.ralph/feedback.md` tells the next iteration what to fix.

**Conventions for every task**
- From the repo root, `npm run build`, `npm run lint` and `npm test` must pass.
- Once `modern/api` serves on port 3000 (`npm run start -w modern/api`), run the characterization suite against it and update the **ratchet**:
  ```
  cd tests/characterization
  BASE_URL=http://localhost:3000 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/modern.json npx playwright test --reporter=json,line
  node ../../.github/scripts/check-ratchet.mjs /tmp/modern.json ../../modern/ratchet.txt
  ```
  - Append every line it lists under "Passing but not yet in modern/ratchet.txt" to `modern/ratchet.txt`.
  - Never remove a line. CI fails if a listed test stops passing, so a task is not done if it breaks one.
- Never edit `tests/characterization/` to make modern pass (CLAUDE.md).
- Tick the box, commit with a message naming the task number, and add one line to `NOTES.md` if anything was surprising.

**Fixed decisions** (from SPEC.md §1). Changing any of these needs a NOTES.md entry.
- npm workspaces: `modern/api`, `modern/web`.
- DB access: `pg` (node-postgres) with hand-written SQL that mirrors the legacy queries. No ORM, so the parity-critical SQL stays visible.
- Tests: Vitest for unit and integration tests. Playwright characterization tests are the acceptance gate.
- Postgres 17 in docker compose, service `db`, host port 5433, database `petclinic`, user/password `petclinic`/`petclinic`.
- Single origin on port 3000: Fastify serves `/api/*`, `/vets.json`, `/vets.xml`, `/resources/*` and the built SPA.

---

## A. Foundations

- [x] **1. Root workspace and tooling.**
  - Root `package.json` with workspaces `modern/api` and `modern/web`, plus scripts `build`, `lint`, `test`, `typecheck` that run across workspaces.
  - `tsconfig.base.json` with strict mode, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
  - ESLint flat config (typescript-eslint, strict) and Prettier.
  - Done when `npm run lint` and `npm run build` succeed on empty workspaces.
- [x] **2. Postgres service.** Done during sandbox setup: `db` in `docker-compose.yml` uses `pgvector/pgvector:pg17` (Postgres 17 plus pgvector), host port 5433, with a healthcheck. In the sandbox, `psql "$DATABASE_URL" -c 'select 1'` works.
- [x] **3. API scaffold.**
  - `modern/api`: Fastify + TypeScript; `src/server.ts` and `src/app.ts` (`buildApp()` factory, so tests can use `inject`).
  - `GET /api/health` returns `{ status: "ok" }`.
  - Structured logging via Fastify's pino logger.
  - Config from env: `PORT` (default 3000) and `DATABASE_URL` (default `postgres://petclinic:petclinic@localhost:5433/petclinic`, which is the host setup; the sandbox sets its own).
  - One Vitest test using `app.inject`.
  - Done when `npm test -w modern/api` passes.
- [x] **4. Schema and seed.**
  - `modern/api/db/schema.sql` [SPEC §7.1] and `modern/api/db/seed.sql` with the **H2** seed values [SPEC §7.2].
  - Set sequences with `setval` to `max(id)`.
  - Script `npm run db:reset -w modern/api` drops, recreates and seeds.
  - Integration test: after a reset there are 10 owners, 13 pets, 4 visits, 6 vets and 6 types.
- [x] **5. DB module.**
  - `src/db.ts`: a `pg.Pool` built from `DATABASE_URL`, closed on Fastify `onClose`.
  - Typed row interfaces for every table.
  - Done when there is a passing integration test that queries `types` ordered by name and gets bird, cat, dog, hamster, lizard, snake.

## B. Domain logic (pure, unit-tested)

- [x] **6. Date parsing and formatting.**
  - `src/domain/dates.ts`: `parseLegacyDate(input)` accepts strict `yyyy/MM/dd` and ISO `yyyy-MM-dd`. It rejects invalid calendar dates, single-digit parts and surrounding spaces. Blank or whitespace-only input returns a "missing" result [SPEC §6].
  - Formatters for `yyyy-MM-dd` and `yyyy/MM/dd`.
  - Table-driven tests, including every example in SPEC §6.
- [x] **7. Owner validation.**
  - `src/domain/owner.ts`, following SPEC §6:
    - Not-empty rules, with no trim.
    - Telephone check that mimics BigDecimal with ≤10 integer digits and no fraction. It accepts `1`, `1234567890`, `+123`, `-123`, `1e3` and rejects `abc`, `12345678901`, `123-456`.
    - An empty telephone gives `must not be empty` (D9).
  - Returns `{ field: message }` with one message per field.
  - Unit tests.
- [x] **8. Pet and visit validation and sorting.**
  - `src/domain/pet.ts` and `src/domain/visit.ts`:
    - Pet required rules, `invalid date`, and the duplicate-name rule on create only, case-insensitive [SPEC §5.3].
    - Visit description `must not be empty`; date `invalid date`; a blank visit date gives `is required` (D1 fix).
  - Sorting helpers [SPEC §5.2]: pets by name case-insensitively by code unit; visits by date descending; vets by last name then first name; specialties by name.
  - Unit tests.

## C. API

All JSON routes live under `/api`. Validation failures return **422** `{ errors: { field: message } }`.
A missing entity returns **404** `{ error }`.

- [x] **9. Read endpoints.**
  - `GET /api/owners?lastName=`: ILIKE prefix, unescaped, `ORDER BY id`, pets included [SPEC §5.1].
  - `GET /api/owners/:id`: owner with sorted pets, each with type name and sorted visits.
  - `GET /api/pettypes`.
  - `GET /api/owners/:ownerId/pets/:petId`: pet with owner name and visits.
  - `GET /api/vets`.
  - A non-numeric id returns 400.
  - Integration tests against the seeded DB.
- [x] **10. Legacy vets endpoints.**
  - `GET /vets.json` and `GET /vets.xml` with exact bodies and content types [SPEC §7.3].
  - Done when `BASE_URL=http://localhost:3000 npm --prefix tests/characterization test -- vets.spec.ts -g "GET /vets"` passes.
- [x] **11. Owner write endpoints.**
  - `POST /api/owners` returns 201 `{ id }`.
  - `PUT /api/owners/:id` returns 204.
  - Both use task 7's validation and return 422 on errors.
  - Integration tests.
- [x] **12. Pet write endpoints.**
  - `POST /api/owners/:ownerId/pets` and `PUT /api/owners/:ownerId/pets/:petId`.
  - The type is given by name; an unknown name gives `invalid value` (D5).
  - Use path ids only and ignore any id in the body (D7).
  - Duplicate check on create only.
  - Integration tests.
- [x] **13. Visit write endpoint.**
  - `POST /api/owners/:ownerId/pets/:petId/visits`.
  - Integration tests, including the D1 fix (blank date gives 422 `is required`).

## D. Web app

- [ ] **14. Web scaffold and static serving.**
  - `modern/web`: Vite + React + TypeScript + React Router, built to `modern/web/dist`.
  - Copy into `modern/web/public/resources/`: `petclinic.css`, the fonts and the images from `legacy/src/main/webapp/resources/`.
  - Get Font Awesome 4.7 from npm (`font-awesome@4.7.0`).
  - Fastify (`@fastify/static`) serves `dist` and `/resources/*`.
  - Page-route status rules [SPEC §1]: known patterns return `index.html` with 200, a non-numeric id returns 400, anything else returns 404.
  - Done when `errors.spec.ts` tests "unknown path returns 404" and "non-numeric owner id returns 400" pass.
- [ ] **15. Layout and welcome page.**
  - Document title, navbar (4 links + brand), Pivotal footer image [SPEC §2].
  - Welcome page [SPEC §3].
  - Done when `home-and-nav.spec.ts` passes, except tests that need pages not built yet.
- [ ] **16. Error page and `/oups`.**
  - Reusable `ErrorPage` component [SPEC §4.8].
  - `/oups` renders it with the exact message.
  - Unknown owner (API 404) renders it with HTTP 200.
  - Done when `errors.spec.ts` passes.
- [ ] **17. Vets page** [SPEC §4.7]. Done when `vets.spec.ts` passes.
- [ ] **18. Find Owners and owners list** [SPEC §4.1, §4.2, §5.1].
  - Search via `?lastName=`.
  - One result navigates with replace to `/owners/{id}`; none shows the error in the field container.
  - Done when `find-owners.spec.ts` passes, except tests needing owner create (task 20).
- [ ] **19. Owner details page** [SPEC §4.3].
  - Keep the label/value text order exactly.
  - Done when the `owner details` tests in `owners.spec.ts` pass (the escaping test needs task 20).
- [ ] **20. Owner form, new and edit** [SPEC §4.4].
  - Shared `OwnerForm`.
  - The field `name` attributes are the contract.
  - Each error renders inside the field's wrapper element.
  - After saving, navigate to `/owners/{id}`.
  - Done when `owners.spec.ts` and `find-owners.spec.ts` pass.
- [ ] **21. Pet form, new and edit** [SPEC §4.5].
  - `<select name="type">`.
  - Date input shows and accepts `yyyy-MM-dd`, and also accepts `yyyy/MM/dd` typed in.
  - Owner row.
  - Done when `pets.spec.ts` passes.
- [ ] **22. Visit form** [SPEC §4.6].
  - Pet table with dates as `yyyy/MM/dd`.
  - Date pre-filled with today as `yyyy-MM-dd`.
  - Previous visits.
  - Done when `visits.spec.ts` passes.

## E. Finish

- [ ] **23. Legacy-defect findings.**
  - Run `INCLUDE_LEGACY_BUGS=1` against modern.
  - Confirm that each failing `@legacy-bug` test corresponds to a fix listed in SPEC §8 (all defects are fixed by decision).
  - Write `FINDINGS.md`: one entry per defect D1–D10 with the legacy behavior, its root cause in the legacy code (file:line), the modern fix, and the test that shows the difference.
  - Do not edit the tests.
- [ ] **24. Production compose.**
  - Add `modern/Dockerfile` (not under `docker/`, which is protected) and a `modern` compose service: Fastify serving the web app on port 3000, using `db`.
  - Seed on first start.
  - The sandbox has no Docker, so the loop writes these files but cannot run them. Add a NOTES.md line asking the human reviewer to verify on the host: `docker compose up -d legacy db modern`, then the full suite against both 8080 and 3000.
- [ ] **25. Full green run.**
  - The full characterization suite passes against `http://localhost:3000`, and against legacy (`BASE_URL=$LEGACY_URL`) as a regression check.
  - Build, lint and unit tests are clean.
  - Then create `DONE`.
