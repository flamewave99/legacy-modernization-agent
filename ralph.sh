#!/usr/bin/env bash
# Ralph loop orchestrator. Runs on the HOST, never inside the sandbox.
#
#   agent (sandbox)       Claude Code with permission prompts skipped, inside the dev container.
#                         Edits files and makes local commits. No GitHub credentials, no route
#                         to GitHub, read-only .git/config and .git/hooks.
#   orchestrator (host)   This script, with the human's gh login. Keeps the agent's branch in sync
#                         with `migration`, pushes it, opens a PR with auto-merge, and waits.
#                         GitHub merges only when CI is green. CI failures and merge conflicts go
#                         back to the agent through .ralph/feedback.md and are fixed on the same
#                         branch.
#   human                 Reviews milestone PRs (migration -> main) and merges them.
#
# The agent writes to this same checkout, so nothing it touches is trusted here: the prompt comes
# from origin, git runs with hooks and fsmonitor disabled, and protected paths stop the loop.
set -Eeuo pipefail
# A guardrail must never stop silently: report where an unexpected failure happened.
trap 'log "STOP: unexpected failure (exit $?) at line $LINENO: $BASH_COMMAND"' ERR

# The body is one function, called on the last line, so bash parses the whole script before running
# it and edits to this file during a run cannot change what runs.
main() {
  local max_iterations="${MAX_ITERATIONS:-25}"
  local max_attempts="${MAX_ATTEMPTS_PER_PR:-3}"
  local max_idle="${MAX_IDLE_ITERATIONS:-2}"
  local base="${BASE_BRANCH:-migration}"
  local protected='^(ralph\.sh|PROMPT\.md|CLAUDE\.md|\.devcontainer/|\.github/|\.claude/|tests/characterization/|legacy/|docker/)'
  local state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/legacy-modernization-agent"

  if [[ "${DEVCONTAINER:-}" == "true" ]]; then
    die "ralph.sh is the host orchestrator; run it outside the dev container."
  fi
  cd "$(git rev-parse --show-toplevel)"
  mkdir -p "$state_dir" .ralph
  RUN_DIR="logs/ralph-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$RUN_DIR"

  hostgit fetch --quiet origin
  assert_clean_protected_paths "$protected"
  # Recreate the sandbox so config changes (services, env, firewall) always take effect.
  log "Starting sandbox (recreating the container)"
  npx --yes @devcontainers/cli up --workspace-folder . --remove-existing-container > "$RUN_DIR/devcontainer-up.log" 2>&1 \
    || die "dev container failed to start; see $RUN_DIR/devcontainer-up.log"

  local attempts=0 idle=0 i branch resumed pr outcome
  for i in $(seq 1 "$max_iterations"); do
    hostgit fetch --quiet origin
    branch="$(resume_branch "$state_dir" "$base")"
    resumed="$branch"

    if [[ -z "$branch" ]]; then
      rm -f "$FEEDBACK"
      attempts=0
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
    if [[ -n "$resumed" && ! -f "$FEEDBACK" ]]; then
      # Resumed with nothing for the agent to fix (e.g. the loop was stopped while waiting):
      # re-check the PR instead of letting the agent start the next task on this branch.
      log "Resuming $branch; re-checking its PR before involving the agent."
    else
      run_agent "$base" "$RUN_DIR/iteration-$i" || log "agent exited non-zero"
    fi

    # Nothing from the agent is trusted until these checks pass.
    [[ "$(hostgit branch --show-current)" == "$branch" ]] || die "agent left branch $branch; stopping."
    assert_no_protected_changes "$base" "$protected"
    [[ -z "$(hostgit status --porcelain)" ]] || die "agent left uncommitted changes on $branch; stopping for a human."

    if [[ "$(hostgit rev-list --count "origin/$base..HEAD")" -eq 0 ]]; then
      idle=$((idle + 1))
      log "No commits this iteration ($idle/$max_idle)."
      rm -f "$state_dir/pr-branch" "$FEEDBACK"
      hostgit switch --quiet "$base" && hostgit branch --quiet -D "$branch"
      [[ "$idle" -lt "$max_idle" ]] || die "agent made no progress $max_idle times in a row; see NOTES.md and fix_plan.md."
      continue
    fi
    idle=0
    echo "$branch" > "$state_dir/pr-branch"

    if ! sync_with_base "$base"; then
      outcome=conflict
    else
      push_branch "$branch"
      pr="$(ensure_pr "$base" "$branch")"
      gh pr merge "$pr" --auto --squash --delete-branch > /dev/null
      outcome="$(wait_for_pr "$pr" "$base" "$branch")"
    fi

    case "$outcome" in
      merged)
        log "PR #$pr merged into $base."
        rm -f "$state_dir/pr-branch" "$FEEDBACK"
        hostgit fetch --quiet origin
        local before after
        before="$(completed_sections "$base")"
        after="$(completed_sections "origin/$base")"
        hostgit switch --quiet "$base"
        hostgit merge --quiet --ff-only "origin/$base"
        hostgit branch --quiet -D "$branch" || true
        open_milestone_pr "$base" "$before" "$after"
        ;;
      ci-failed | conflict)
        attempts=$((attempts + 1))
        log "$outcome on $branch (attempt $attempts/$max_attempts); handing it back to the agent."
        if [[ "$outcome" == ci-failed ]]; then
          write_ci_feedback "$pr" "$branch"
        else
          write_conflict_feedback "$base" "$branch"
        fi
        [[ "$attempts" -lt "$max_attempts" ]] || die "$branch still failing after $max_attempts attempts; its PR stays open for a human."
        ;;
      *)
        die "PR #${pr:-?} is stuck ($outcome); a human should look at it on GitHub."
        ;;
    esac
  done
  log "Hit the iteration cap ($max_iterations) without DONE."
}

FEEDBACK=".ralph/feedback.md"
RUN_DIR=""

# Logs go to stderr so functions can return values on stdout.
log() { printf '[ralph %s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
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
# The three-dot diff covers only the branch's own changes, so merging migration in (which may
# carry human changes to protected paths) does not trip it.
assert_no_protected_changes() {
  local base="$1" protected="$2" changed
  changed="$( { hostgit diff --name-only "origin/$base"...HEAD; hostgit status --porcelain | cut -c4-; } \
    | sort -u | grep -E "$protected" || true)"
  [[ -z "$changed" ]] || die "protected paths changed; a human must review:"$'\n'"$changed"
}

# The branch to continue (from an earlier failed attempt), or nothing to start a new one.
resume_branch() {
  local state_dir="$1" base="$2" branch state
  [[ -s "$state_dir/pr-branch" ]] || return 0
  branch="$(cat "$state_dir/pr-branch")"
  [[ "$branch" =~ ^ralph/[0-9-]+$ ]] || die "unexpected branch name in $state_dir/pr-branch: $branch"
  state="$(gh pr list --head "$branch" --base "$base" --state all --json state -q '.[0].state')"
  if [[ "$state" == "MERGED" || "$state" == "CLOSED" ]]; then
    log "PR for $branch was $state outside the loop; starting fresh."
    rm -f "$state_dir/pr-branch" "$FEEDBACK"
    hostgit switch --quiet "$base" && hostgit branch --quiet -D "$branch" || true
    return 0
  fi
  hostgit switch --quiet "$branch"
  echo "$branch"
}

run_agent() {
  local base="$1" log_base="$2"
  if [[ -n "${RALPH_AGENT_CMD:-}" ]]; then
    # Test seam: replace the agent with a scripted command (see NOTES.md).
    bash -c "$RALPH_AGENT_CMD" < /dev/null 2>&1 | tee "$log_base.log" >&2
    return "${PIPESTATUS[0]}"
  fi
  local prompt
  prompt="$(hostgit show "origin/$base:PROMPT.md")"
  # Stream events so progress is visible live: raw JSONL to a file, a readable line per step to the log.
  npx --yes @devcontainers/cli exec --workspace-folder . \
    claude -p "$prompt" --dangerously-skip-permissions --output-format stream-json --verbose < /dev/null \
    | tee "$log_base.jsonl" | summarize_stream | tee "$log_base.log" >&2
  return "${PIPESTATUS[0]}"
}

# One readable line per assistant message, tool call and final result from Claude's stream-json.
summarize_stream() {
  node -e '
    const rl = require("node:readline").createInterface({ input: process.stdin });
    const short = (s, n) => (s.length > n ? s.slice(0, n) + "..." : s).replace(/\s+/g, " ");
    rl.on("line", (line) => {
      let e; try { e = JSON.parse(line); } catch { return; }
      if (e.type === "assistant") for (const b of e.message?.content ?? []) {
        if (b.type === "text" && b.text.trim()) console.log("  agent: " + short(b.text, 200));
        if (b.type === "tool_use") console.log("  tool:  " + b.name + " " + short(JSON.stringify(b.input), 160));
      }
      if (e.type === "result") console.log("  done:  " + short(String(e.result ?? e.subtype), 600));
    });'
}

# Merges origin/<base> into the current branch when it is behind. On conflict the merge is undone
# and CONFLICT_FILES lists the files, for the agent to resolve.
CONFLICT_FILES=""
sync_with_base() {
  local base="$1"
  hostgit fetch --quiet origin
  hostgit merge-base --is-ancestor "origin/$base" HEAD && return 0
  if hostgit merge --quiet --no-edit "origin/$base" > /dev/null 2>&1; then
    log "Merged origin/$base into $(hostgit branch --show-current)."
    return 0
  fi
  CONFLICT_FILES="$(hostgit diff --name-only --diff-filter=U | paste -sd' ')"
  hostgit merge --abort
  log "Merging origin/$base conflicts in: $CONFLICT_FILES"
  return 1
}

try_push() {
  hostgit push --quiet origin "HEAD:refs/heads/$1" > /dev/null 2>&1
}

push_branch() {
  try_push "$1" || die "push of $1 failed."
}

ensure_pr() {
  local base="$1" branch="$2" pr title body
  pr="$(gh pr list --head "$branch" --base "$base" --state open --json number -q '.[0].number')"
  if [[ -z "$pr" ]]; then
    title="$(hostgit log --reverse --no-merges --format=%s "origin/$base..HEAD" | head -1)"
    body="$(printf 'Opened by the Ralph loop orchestrator.\n\nCommits:\n%s\n' \
      "$(hostgit log --reverse --no-merges --format='- %s' "origin/$base..HEAD")")"
    gh pr create --base "$base" --head "$branch" --title "$title" --body "$body" > /dev/null
    pr="$(gh pr list --head "$branch" --base "$base" --state open --json number -q '.[0].number')"
  fi
  echo "$pr"
}

# Prints merged, ci-failed, conflict, or stuck:<reason>. While waiting it keeps the branch in sync
# with base, because branch protection only merges branches that are up to date.
wait_for_pr() {
  local pr="$1" base="$2" branch="$3" waited=0 no_checks=0 info merge_state buckets
  log "Waiting for CI and auto-merge on PR #$pr"
  while [[ "$waited" -lt 2700 ]]; do
    info="$(gh pr view "$pr" --json state,mergeStateStatus -q '.state + " " + .mergeStateStatus')"
    [[ "${info%% *}" == "MERGED" ]] && { echo merged; return; }
    [[ "${info%% *}" == "CLOSED" ]] && { echo "stuck:closed"; return; }
    merge_state="${info#* }"
    if [[ "$merge_state" == "DIRTY" || "$merge_state" == "BEHIND" ]]; then
      # Re-check first: right after a squash-merge the PR can still read OPEN while migration
      # already contains it, and "syncing" then would push to the branch GitHub just deleted.
      [[ "$(gh pr view "$pr" --json state -q .state)" == "MERGED" ]] && { echo merged; return; }
      sync_with_base "$base" || { echo conflict; return; }
      if ! try_push "$branch"; then
        [[ "$(gh pr view "$pr" --json state -q .state)" == "MERGED" ]] && { echo merged; return; }
        echo "stuck:push-failed"; return
      fi
    fi

    # All checks, not just the required "ci" gate: that job only appears once its dependencies finish,
    # and any failing job means the gate will fail.
    buckets="$(gh pr checks "$pr" --json bucket -q '[.[].bucket] | join(" ")' 2>/dev/null || true)"
    if [[ -z "$buckets" ]]; then
      no_checks=$((no_checks + 20))
      [[ "$no_checks" -lt 300 ]] || { echo "stuck:no-ci-checks"; return; }
    elif [[ " $buckets " == *" fail "* ]]; then
      echo ci-failed; return
    else
      no_checks=0
    fi
    sleep 20
    waited=$((waited + 20))
  done
  echo "stuck:timeout"
}

write_ci_feedback() {
  local pr="$1" branch="$2" job name log
  # The failed job's own log: available as soon as that job ends, while `gh run view --log-failed`
  # waits for the whole run. Prefer the job that actually failed over the "ci" gate that reports it.
  read -r job name < <(gh pr checks "$pr" --json name,bucket,link \
    -q '([.[] | select(.bucket == "fail" and .name != "ci")][0] // [.[] | select(.bucket == "fail")][0]) // {}
        | "\(.link // "" | capture("/job/(?<id>[0-9]+)").id // "") \(.name // "")"' || true) || true
  log="$( [[ -n "${job:-}" ]] && gh api --allow-escape-sequences "repos/{owner}/{repo}/actions/jobs/$job/logs" 2>/dev/null \
    | sed -E 's/\x1b\[[0-9;]*m//g; s/^[0-9T:.-]+Z //' | tail -n 300 || true)"
  {
    echo "# CI failed on PR #$pr (branch $branch), job: ${name:-unknown}"
    echo
    echo "Reproduce the failure below locally, fix the cause on this branch, and commit. Do not start a new task."
    echo
    echo '```'
    echo "${log:-(the failed job log could not be fetched; reproduce with build, lint and tests)}"
    echo '```'
  } > "$FEEDBACK"
}

write_conflict_feedback() {
  local base="$1" branch="$2"
  cat > "$FEEDBACK" <<EOF
# Merge conflict with $base (branch $branch)

\`$base\` moved on and now conflicts with this branch in: $CONFLICT_FILES

Run \`git merge origin/$base\` (already fetched), resolve every conflict keeping the intent of both
sides, run build, lint and tests, and commit the merge. In NOTES.md keep every entry from both sides
and renumber this branch's entries to follow the last entry on $base. Do not start a new task.
EOF
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
  newly="$(comm -13 <(echo "$before") <(echo "$after") | sed 's/^## //' | awk 'NR > 1 {printf ", "} {printf "%s", $0}')"
  [[ -n "$newly" ]] || return 0
  existing="$(gh pr list --head "$base" --base main --state open --json number -q '.[0].number')"
  if [[ -n "$existing" ]]; then
    gh pr comment "$existing" --body "Milestone reached: $newly" > /dev/null
  else
    gh pr create --base main --head "$base" \
      --title "Milestone: $newly" \
      --body "fix_plan.md sections completed: $newly. Review, then merge with a merge commit." > /dev/null
  fi
  log "Milestone PR updated for: $newly"
}

main "$@"
exit $?
