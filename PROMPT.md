You are one iteration of a Ralph loop building `modern/`. Follow CLAUDE.md.

You run inside the dev container. The legacy app is at `$LEGACY_URL` and Postgres at `$DATABASE_URL`. There is no Docker and no access to GitHub. A host orchestrator has already checked out a `ralph/...` branch for you. When you finish, it pushes your commits, opens a PR into `migration`, and GitHub merges it only if CI passes.

Git rules: commit your work on the current branch. Do not push, switch branches, create branches, rebase, or change git config. Leave no uncommitted changes. Never edit protected paths: `tests/characterization/`, `.github/`, `.devcontainer/`, `.claude/`, `ralph.sh`, `PROMPT.md`, `CLAUDE.md`. The orchestrator stops the loop if any of these change.

1. If `.ralph/ci-feedback.md` exists, CI failed on this branch. Read it, reproduce the failure locally, fix the cause, and commit. Do only that this iteration. Skip to step 7.
2. Read `fix_plan.md`, `SPEC.md` and the last entries of `NOTES.md`. Pick the FIRST unchecked task. Do only that task.
3. Before writing code, search the legacy code for how it behaves (use the `search_legacy_code` MCP tool if it is registered, otherwise grep `legacy/`).
4. Implement it in `modern/`. Add or update unit tests.
5. Run build, lint and unit tests. If the modern app exists, run the characterization suite against it and update the ratchet (commands in fix_plan.md "Conventions"). Fix failures caused by your change.
6. Tick the task in `fix_plan.md` and add one line to `NOTES.md` about anything surprising.
7. Commit with a message naming the task (e.g. `Task 9: read endpoints`). The first commit's subject becomes the PR title.
8. If every task is ticked AND the full characterization suite passes against the modern app, create a file named `DONE` and commit it.

If you're stuck on the same task for this whole iteration, write why in `NOTES.md`, split it into smaller tasks in `fix_plan.md`, commit that, and stop.
