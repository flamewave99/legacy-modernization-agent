#!/usr/bin/env bash
# Ralph loop orchestrator. Runs on the HOST, never inside the sandbox.
#
#   agent (sandbox)       Claude Code with permission prompts skipped, inside the dev container.
#                         Edits files and makes local commits. No GitHub credentials, no route
#                         to GitHub, read-only .git/config and .git/hooks.
#   orchestrator (host)   This script, with the human's gh login. Pushes the agent's branch,
#                         opens a PR into `migration` with auto-merge, and waits for CI. GitHub
#                         merges only when CI is green. On failure, the failed CI log goes to
#                         .ralph/ci-feedback.md and the next iteration fixes it on the same branch.
#   human                 Reviews milestone PRs (migration -> main) and merges them.
#
# The agent writes to this same checkout, so nothing it touches is trusted here: the prompt comes
# from origin, git runs with hooks and fsmonitor disabled, and protected paths stop the loop.
set -euo pipefail

# The body is one function, called on the last line, so bash parses the whole script before running
# it and edits to this file during a run cannot change what runs.
main() {
  local max_iterations="${MAX_ITERATIONS:-25}"
  local max_ci_failures="${MAX_CI_FAILURES:-3}"
  local max_idle="${MAX_IDLE_ITERATIONS:-2}"
  local base="${BASE_BRANCH:-migration}"
  local protected='^(ralph\.sh|PROMPT\.md|CLAUDE\.md|\.devcontainer/|\.github/|\.claude/|tests/characterization/)'
  local state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/legacy-modernization-agent"
  local feedback=".ralph/ci-feedback.md"

  if [[ "${DEVCONTAINER:-}" == "true" ]]; then
    die "ralph.sh is the host orchestrator; run it outside the dev container."
  fi
  cd "$(git rev-parse --show-toplevel)"
  mkdir -p "$state_dir" .ralph
  local run_dir; run_dir="logs/ralph-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$run_dir"

  hostgit fetch --quiet origin
  assert_clean_protected_paths "$protected"
  log "Starting sandbox"
  npx --yes @devcontainers/cli up --workspace-folder . > "$run_dir/devcontainer-up.log" 2>&1 \
    || die "dev container failed to start; see $run_dir/devcontainer-up.log"

  local ci_failures=0 idle=0 i branch pr
  for i in $(seq 1 "$max_iterations"); do
    hostgit fetch --quiet origin

    # Resume a branch whose CI failed, or start a new one from the latest base.
    if [[ -s "$state_dir/pr-branch" ]]; then
      branch="$(cat "$state_dir/pr-branch")"
      hostgit switch --quiet "$branch"
    else
      rm -f "$feedback"
      hostgit switch --quiet "$base"
      hostgit merge --quiet --ff-only "origin/$base"
      if [[ -f DONE ]]; then
        log "DONE found on $base after $((i - 1)) iterations."
        return 0
      fi
      branch="ralph/$(date +%Y%m%d-%H%M%S)"
      hostgit switch --quiet -c "$branch"
    fi

    log "=== Iteration $i/$max_iterations on $branch ==="
    run_agent "$base" > >(tee "$run_dir/iteration-$i.log") 2>&1 || log "agent exited non-zero"

    # Nothing from the agent is trusted until these checks pass.
    [[ "$(hostgit branch --show-current)" == "$branch" ]] || die "agent left branch $branch; stopping."
    assert_no_protected_changes "$base" "$protected"
    [[ -z "$(hostgit status --porcelain)" ]] || die "agent left uncommitted changes on $branch; stopping for a human."

    if [[ "$(hostgit rev-list --count "origin/$base..HEAD")" -eq 0 ]]; then
      idle=$((idle + 1))
      log "No commits this iteration ($idle/$max_idle)."
      hostgit switch --quiet "$base" && hostgit branch --quiet -D "$branch"
      [[ "$idle" -lt "$max_idle" ]] || die "agent made no progress $max_idle times in a row; see NOTES.md and fix_plan.md."
      continue
    fi
    idle=0

    hostgit push --quiet origin "HEAD:refs/heads/$branch"
    pr="$(ensure_pr "$base" "$branch")"
    gh pr merge "$pr" --auto --squash --delete-branch > /dev/null

    if wait_for_ci "$pr"; then
      wait_for_merge "$pr" || die "PR #$pr passed CI but did not merge; check its status on GitHub."
      log "PR #$pr merged into $base."
      rm -f "$state_dir/pr-branch" "$feedback"
      ci_failures=0
      hostgit fetch --quiet origin
      local before after
      before="$(completed_sections "$base")"
      after="$(completed_sections "origin/$base")"
      hostgit switch --quiet "$base"
      hostgit merge --quiet --ff-only "origin/$base"
      hostgit branch --quiet -D "$branch" || true
      open_milestone_pr "$base" "$before" "$after"
    else
      ci_failures=$((ci_failures + 1))
      log "CI failed on PR #$pr ($ci_failures/$max_ci_failures)."
      echo "$branch" > "$state_dir/pr-branch"
      write_ci_feedback "$pr" "$branch"
      [[ "$ci_failures" -lt "$max_ci_failures" ]] \
        || die "CI failed $max_ci_failures times on PR #$pr; it stays open for a human."
    fi
  done
  log "Hit the iteration cap ($max_iterations) without DONE."
}

log() { printf '[ralph %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "STOP: $*"; exit 1; }

# Git on the host never runs hooks or fsmonitor commands from this shared checkout.
hostgit() { git -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"; }

# Startup check: no uncommitted edits to protected paths in the working tree.
assert_clean_protected_paths() {
  local protected="$1" changed
  changed="$(hostgit status --porcelain | cut -c4- | grep -E "$protected" || true)"
  [[ -z "$changed" ]] || die "uncommitted changes to protected paths; commit or revert them first:"$'\n'"$changed"
}

# After each agent run: nothing on the branch or in the working tree touches protected paths.
assert_no_protected_changes() {
  local base="$1" protected="$2" changed
  changed="$( { hostgit diff --name-only "origin/$base"...HEAD; hostgit status --porcelain | cut -c4-; } \
    | sort -u | grep -E "$protected" || true)"
  [[ -z "$changed" ]] || die "protected paths changed; a human must review:"$'\n'"$changed"
}

run_agent() {
  local base="$1"
  if [[ -n "${RALPH_AGENT_CMD:-}" ]]; then
    # Test seam: replace the agent with a scripted command (see NOTES.md).
    bash -c "$RALPH_AGENT_CMD"
    return
  fi
  local prompt
  prompt="$(hostgit show "origin/$base:PROMPT.md")"
  npx --yes @devcontainers/cli exec --workspace-folder . \
    claude -p "$prompt" --dangerously-skip-permissions
}

ensure_pr() {
  local base="$1" branch="$2" pr title body
  pr="$(gh pr list --head "$branch" --base "$base" --state open --json number -q '.[0].number')"
  if [[ -z "$pr" ]]; then
    title="$(hostgit log --reverse --format=%s "origin/$base..HEAD" | head -1)"
    body="$(printf 'Opened by the Ralph loop orchestrator.\n\nCommits:\n%s\n' \
      "$(hostgit log --reverse --format='- %s' "origin/$base..HEAD")")"
    gh pr create --base "$base" --head "$branch" --title "$title" --body "$body" > /dev/null
    pr="$(gh pr list --head "$branch" --base "$base" --state open --json number -q '.[0].number')"
  fi
  echo "$pr"
}

wait_for_ci() {
  local pr="$1" tries=0
  # Checks take a few seconds to register after a push.
  until gh pr checks "$pr" > /dev/null 2>&1 || [[ $? -eq 8 ]]; do
    tries=$((tries + 1)); [[ "$tries" -lt 24 ]] || return 1
    sleep 5
  done
  log "Waiting for CI on PR #$pr"
  gh pr checks "$pr" --watch --interval 20 > /dev/null 2>&1
}

wait_for_merge() {
  local pr="$1" tries
  for tries in $(seq 1 60); do
    [[ "$(gh pr view "$pr" --json state -q .state)" == "MERGED" ]] && return 0
    sleep 5
  done
  return 1
}

write_ci_feedback() {
  local pr="$1" branch="$2" run_id
  run_id="$(gh run list --branch "$branch" --workflow ci --limit 1 --json databaseId -q '.[0].databaseId')"
  {
    echo "# CI failed on PR #$pr (branch $branch)"
    echo
    echo "Fix the cause below on this branch and commit. Do not start a new task."
    echo
    echo '```'
    gh run view "$run_id" --log-failed 2>&1 | tail -n 300
    echo '```'
  } > .ralph/ci-feedback.md
}

# fix_plan.md sections ("## X. Name") whose checkboxes are all ticked, as of a git ref.
completed_sections() {
  hostgit show "$1:fix_plan.md" \
    | awk '/^## /{s=$0; seen[s]=1; open[s]+=0; next} s && /^- \[ \]/{open[s]++}
           END{for (k in seen) if (open[k]==0) print k}' | sort
}

# When a section of fix_plan.md completes, propose migration -> main for human review.
open_milestone_pr() {
  local base="$1" before="$2" after="$3" newly existing
  newly="$(comm -13 <(echo "$before") <(echo "$after") | sed 's/^## //')"
  [[ -n "$newly" ]] || return 0
  existing="$(gh pr list --head "$base" --base main --state open --json number -q '.[0].number')"
  if [[ -n "$existing" ]]; then
    gh pr comment "$existing" --body "Milestone reached: $(echo "$newly" | paste -sd', ')" > /dev/null
  else
    gh pr create --base main --head "$base" \
      --title "Milestone: $(echo "$newly" | paste -sd', ')" \
      --body "fix_plan.md sections completed: $(echo "$newly" | paste -sd', '). Review, then merge with a merge commit." > /dev/null
  fi
  log "Milestone PR updated for: $newly"
}

main "$@"
exit $?
