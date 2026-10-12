We're building a portfolio project called **legacy-modernization-agent**. Read README.md and CLAUDE.md in this folder first; they're the plan and the rules.

Today, do Phases 1 and 2 only:

1. Clone https://github.com/spring-petclinic/spring-framework-petclinic into `legacy/` and get it running in Docker (add a Dockerfile/compose service if needed). Confirm it serves on localhost.
2. Write characterization tests in `tests/characterization/` with Playwright (TypeScript) covering every user flow: find owners, add/edit owner, add/edit pet, add visit, vets list, validation errors, and error pages. Tests must read the base URL from `BASE_URL` so the same suite can later run against the modern app. Run them against the legacy app until they pass.
3. Launch subagents in parallel to analyze the legacy code (controllers and routes, domain model and DB schema, JSP views, validation and business rules). Merge their findings into `SPEC.md`.
4. Turn SPEC.md into `fix_plan.md`: a checklist of small, ordered tasks for building `modern/` (TypeScript, React + Vite frontend, Node + Fastify API, Postgres, same behavior and routes as legacy). Each task should be doable in one loop iteration.
5. Initialize git, commit, and tell me what's ready and anything that blocked you.

Ask me before installing anything system-wide or creating the GitHub repo.
