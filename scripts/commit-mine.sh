#!/usr/bin/env bash
# commit-mine.sh "<commit message>" <file> [<file>...]
#
# AutoSave-safe commit: the AEVION AutoSave task commits the whole worktree
# every 30 minutes as "chore(backup): auto ...". When it lands on your branch
# between your edits and your commit, `git commit` sees a clean tree and your
# work ships under the wrong message (or a later squash carries the noise).
# This helper folds a top-of-branch AutoSave commit back in, stages ONLY the
# files you name, and commits them under your message. Anything else the
# AutoSave grabbed is left unstaged — it belongs to a parallel session.
#
# Used four times by hand on 2026-07-21/23 before becoming a script.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: commit-mine.sh \"<commit message>\" <file> [<file>...]" >&2
  exit 1
fi
MSG="$1"; shift

LAST_SUBJECT=$(git log -1 --format=%s)
case "$LAST_SUBJECT" in
  "chore(backup): auto"*)
    echo "AutoSave commit on top ('$LAST_SUBJECT') — folding it back in"
    git reset --soft HEAD~1
    ;;
esac

# Start from a clean stage so only the named files go into this commit.
git restore --staged . 2>/dev/null || true
git add -- "$@"
git commit -m "$MSG"

LEFTOVER=$(git status --short | grep -v '^??' || true)
if [ -n "$LEFTOVER" ]; then
  echo ""
  echo "Left unstaged (likely a parallel session's work — do NOT sweep blindly):"
  echo "$LEFTOVER"
fi
