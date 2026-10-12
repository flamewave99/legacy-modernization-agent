#!/usr/bin/env bash
# Ralph loop: run Claude Code headless against PROMPT.md until DONE exists or the cap is hit.
# Permission prompts are skipped, so this only runs inside the dev container (.devcontainer/),
# whose firewall limits outbound traffic and which has no Docker socket.
set -euo pipefail

MAX_ITERATIONS="${MAX_ITERATIONS:-25}"

if [[ "${DEVCONTAINER:-}" != "true" && "${ALLOW_HOST:-}" != "1" ]]; then
  echo "Refusing to run outside the dev container (set ALLOW_HOST=1 to override)." >&2
  exit 1
fi

# Never commit to main: each run works on its own branch for human review and merge.
branch="$(git branch --show-current)"
if [[ "$branch" == "main" ]]; then
  branch="ralph/$(date +%Y%m%d-%H%M)"
  git switch -c "$branch"
fi
echo "Ralph loop on branch $branch"

run_dir="logs/${branch//\//-}"
mkdir -p "$run_dir"

for i in $(seq 1 "$MAX_ITERATIONS"); do
  if [[ -f DONE ]]; then
    echo "DONE found after $((i - 1)) iterations."
    exit 0
  fi
  echo "=== Ralph iteration $i / $MAX_ITERATIONS ==="
  claude -p "$(cat PROMPT.md)" --dangerously-skip-permissions | tee "$run_dir/iteration-$i.log"
done

echo "Hit the iteration cap ($MAX_ITERATIONS) without DONE. Check fix_plan.md and NOTES.md."
