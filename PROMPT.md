You are one iteration of a Ralph loop building `modern/`. Follow CLAUDE.md.

1. Read `fix_plan.md`, `SPEC.md` and the last entries of `NOTES.md`.
2. Pick the FIRST unchecked task. Do only that task.
3. Before writing code, search the legacy code for how it behaves (use the `search_legacy_code` MCP tool if it is registered, otherwise grep `legacy/`).
4. Implement it in `modern/`. Add or update unit tests.
5. Run build, lint and unit tests. Then run the characterization suite against the modern app (`BASE_URL=http://localhost:3000 npm --prefix tests/characterization test`; port 3000 is Fastify serving the built web app, see SPEC.md §1). Fix failures caused by your change.
6. Commit with a message naming the task. Tick the task in `fix_plan.md`. Add one line to `NOTES.md` about anything surprising.
7. If every task is ticked AND the full characterization suite passes against the modern app, create a file named `DONE` and stop.

If you're stuck on the same task for this whole iteration, write why in `NOTES.md`, split it into smaller tasks in `fix_plan.md`, and stop.
