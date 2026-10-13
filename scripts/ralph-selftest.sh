#!/usr/bin/env bash
# Offline self-test of ralph.sh's usage-limit handling. Runs the real orchestrator in a throwaway
# clone whose "origin" is a local bare repo, with stand-ins for `gh` and `npx` on PATH and a
# scripted agent (RALPH_AGENT_CMD), so nothing reaches GitHub, the sandbox or a model.
#
#   scripts/ralph-selftest.sh
#
# Scenario 1: the first run is cut off by a usage limit before committing anything. The loop waits
#   for the reset, deletes the empty branch, and the next run starts on a fresh branch.
# Scenario 2: the agent commits, then hits the limit. The loop waits, keeps the branch, and the next
#   iteration opens its PR without re-running the agent.
set -Eeuo pipefail

repo="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

# A base branch without DONE (the real one is finished), served from a local bare repo.
git clone --quiet --no-local "$repo" "$tmp/work"
git -C "$tmp/work" switch --quiet -C migration origin/migration 2> /dev/null || git -C "$tmp/work" switch --quiet -C migration
git -C "$tmp/work" rm --quiet -f --ignore-unmatch DONE
git -C "$tmp/work" -c user.name=t -c user.email=t@t commit --quiet --allow-empty -m "selftest base"
cp "$repo/ralph.sh" "$tmp/work/ralph.sh"
git -C "$tmp/work" -c user.name=t -c user.email=t@t commit --quiet -am "ralph.sh under test" || true
git clone --quiet --bare "$tmp/work" "$tmp/origin.git"
git -C "$tmp/work" remote set-url origin "$tmp/origin.git"
git -C "$tmp/work" fetch --quiet origin
git -C "$tmp/work" config user.name t
git -C "$tmp/work" config user.email t@t

# Stand-ins: npx (dev container start) succeeds; gh reports one open PR that is already merged.
mkdir -p "$tmp/bin"
printf '#!/bin/sh\nexit 0\n' > "$tmp/bin/npx"
cat > "$tmp/bin/gh" << 'EOF'
#!/bin/sh
case "$1 $2" in
  "pr list") echo 7 ;;
  "pr view") echo "MERGED" ;;
esac
exit 0
EOF
chmod +x "$tmp/bin/npx" "$tmp/bin/gh"

run_loop() {
  (cd "$tmp/work" && PATH="$tmp/bin:$PATH" XDG_STATE_HOME="$tmp/state" MAX_ITERATIONS=3 MAX_IDLE_ITERATIONS=1 \
    RALPH_AGENT_CMD="$1" ./ralph.sh 2>&1) || true
}

# The scripted agent counts its runs in a file; the first run emits a rejected rate-limit event
# whose reset time is already past, so the loop's wait is zero.
past=$(($(date +%s) - 120))
limit_event="{\"type\":\"rate_limit_event\",\"rate_limit_info\":{\"status\":\"rejected\",\"resetsAt\":$past}}"
counter="$tmp/runs"

echo "== Scenario 1: limit before any commit"
out="$(run_loop "n=\$(cat $counter 2>/dev/null || echo 0); echo \$((n + 1)) > $counter;
  if [ \$n -eq 0 ]; then echo '$limit_event'; exit 1; fi; echo 'nothing to do'")"
echo "$out"
grep -q 'Usage limit reset; resuming.' <<< "$out" || fail "did not resume after the limit"
grep -q 'No commits this iteration (1/1)' <<< "$out" || fail "the run after the limit should be iteration 1, not 2"
[[ "$(cat "$counter")" -eq 2 ]] || fail "expected 2 agent runs, got $(cat "$counter")"
[[ -z "$(git -C "$tmp/work" branch --list 'ralph/*')" ]] || fail "empty ralph/ branch left behind"
ls "$tmp/work"/logs/ralph-*/ralph.log > /dev/null || fail "ralph.log not written"

echo "== Scenario 2: limit after a commit"
rm -f "$counter"
git -C "$tmp/work" switch --quiet migration
out="$(run_loop "n=\$(cat $counter 2>/dev/null || echo 0); echo \$((n + 1)) > $counter;
  if [ \$n -eq 0 ]; then echo work > selftest.txt; git add selftest.txt; git commit --quiet -m 'Task X: partial';
  echo '$limit_event'; exit 1; fi; echo 'nothing to do'")"
echo "$out"
grep -q 'Usage limit reset; resuming.' <<< "$out" || fail "did not resume after the limit"
grep -q 'Resuming ralph/' <<< "$out" || fail "the branch with commits was not resumed"
grep -q 'PR #7 merged' <<< "$out" || fail "the resumed branch did not go through the PR flow"
git -C "$tmp/origin.git" for-each-ref --format='%(refname)' refs/heads/ralph/ | grep -q . || fail "branch was not pushed"

echo "PASS: usage-limit handling"
