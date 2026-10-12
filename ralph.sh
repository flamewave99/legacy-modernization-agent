#!/usr/bin/env bash
# Ralph loop: run Claude Code headless against PROMPT.md until DONE exists or the cap is hit.
# Run only inside this project folder (ideally a dev container), since permission prompts are skipped.
set -euo pipefail

MAX_ITERATIONS="${MAX_ITERATIONS:-25}"
mkdir -p logs

for i in $(seq 1 "$MAX_ITERATIONS"); do
  if [[ -f DONE ]]; then
    echo "DONE found after $((i - 1)) iterations."
    exit 0
  fi
  echo "=== Ralph iteration $i / $MAX_ITERATIONS ==="
  claude -p "$(cat PROMPT.md)" --dangerously-skip-permissions | tee "logs/iteration-$i.log"
done

echo "Hit the iteration cap ($MAX_ITERATIONS) without DONE. Check fix_plan.md and NOTES.md."
