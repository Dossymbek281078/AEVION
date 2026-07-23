#!/usr/bin/env bash
# merge-when-green.sh <pr-number> [<pr-number>...]
#
# Merge each PR as soon as its REQUIRED status checks pass, in the order given.
# main is a protected branch (required checks: "Backend (tsc + integration
# tests)" and "Frontend (next build)"), and this repo has auto-merge DISABLED
# (enablePullRequestAutoMerge = false), so `gh pr merge --auto` is rejected and
# you cannot "set and forget". The working pattern is to poll the required
# checks and merge on green — done by hand ~10 times in one session (and twice
# with the wrong PR number) before becoming a script.
#
# Stacked-PR note: CI only runs on a PR whose BASE is main. A PR opened onto a
# feat/* branch never triggers the required checks, and retargeting to main
# afterwards does not wake them. Reopen it first to fire CI:
#     gh pr close <N> && gh pr reopen <N>
# See docs/OPS_CI_AND_SMOKE.md for the full write-up.
#
# Stops at the first PR whose CI FAILS, so a broken change in a stack does not
# drag the rest in behind it.
#
# Env:
#   REQUIRED_CHECKS  space-or-newline-separated check names to wait for
#                    (default: the two AEVION gates above)
#   POLL_SECONDS     seconds between polls (default 30)
#   MAX_POLLS        give up after this many polls per PR (default 80 ≈ 40 min)
set -uo pipefail

if [ $# -lt 1 ]; then
  echo "usage: merge-when-green.sh <pr-number> [<pr-number>...]" >&2
  exit 1
fi

DEFAULT_CHECKS=$'Backend (tsc + integration tests)\nFrontend (next build)'
REQUIRED_CHECKS="${REQUIRED_CHECKS:-$DEFAULT_CHECKS}"
POLL_SECONDS="${POLL_SECONDS:-30}"
MAX_POLLS="${MAX_POLLS:-80}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# Read the conclusion/status of one named check from a PR's statusCheckRollup.
check_state() {
  local pr="$1" name="$2"
  gh pr view "$pr" --json statusCheckRollup --jq \
    --arg n "$name" \
    '[.statusCheckRollup[] | select((.name // .context) == $n) | (.conclusion // .status // "MISSING")][0] // "MISSING"' \
    2>/dev/null
}

merge_one() {
  local pr="$1"
  local state
  state=$(gh pr view "$pr" --json state --jq .state 2>/dev/null)
  if [ "$state" = "MERGED" ]; then log "#$pr already merged — skip"; return 0; fi
  if [ "$state" != "OPEN" ]; then log "#$pr is $state (not OPEN) — skip"; return 1; fi

  log "#$pr: waiting for required checks..."
  local i
  for ((i = 1; i <= MAX_POLLS; i++)); do
    local all_pass=1 any_fail=0
    while IFS= read -r name; do
      [ -z "$name" ] && continue
      local c; c=$(check_state "$pr" "$name")
      [ "$c" = "SUCCESS" ] || all_pass=0
      case "$c" in FAILURE|ERROR|CANCELLED|TIMED_OUT) any_fail=1 ;; esac
    done <<< "$REQUIRED_CHECKS"

    if [ "$any_fail" = 1 ]; then
      log "#$pr: a required check FAILED — stopping (needs a look)"
      return 3
    fi
    if [ "$all_pass" = 1 ]; then
      log "#$pr: green → merging"
      if gh pr merge "$pr" --merge --delete-branch=false >/dev/null 2>&1; then
        log "#$pr: ✓ MERGED"
        return 0
      fi
      log "#$pr: merge was rejected: $(gh pr merge "$pr" --merge 2>&1 | head -1)"
      return 2
    fi
    sleep "$POLL_SECONDS"
  done
  log "#$pr: timed out waiting for CI"
  return 4
}

rc=0
for pr in "$@"; do
  merge_one "$pr" || { rc=$?; log "stopping at #$pr (exit $rc)"; break; }
done
exit "$rc"
