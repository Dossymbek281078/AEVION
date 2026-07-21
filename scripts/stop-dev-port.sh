#!/usr/bin/env bash
# Kill whatever is listening on a dev-server port, by its real Windows PID.
#
# Why this exists: on Windows + Git Bash, `pkill -f "next dev"` (or any
# name-based pkill) frequently fails to stop a running `next dev` server —
# Git Bash's `ps`/`pkill` operate on the MSYS process table, which uses a
# different PID numbering than the native Windows PID that actually holds
# the port (the one `netstat -ano` and `taskkill` see). Killing "next dev"
# by name routinely misses the real listener, leaving an orphaned server
# that then forces every subsequent `npm run dev` in the same directory
# onto the next free port (3001, 3002, ...) instead of actually being dead.
#
# Usage: scripts/stop-dev-port.sh [port] (default 3000)

set -euo pipefail
PORT="${1:-3000}"

PIDS=$( (netstat -ano 2>/dev/null | grep -E "LISTENING" | grep -E ":${PORT} " | awk '{print $NF}' | sort -u) || true)

if [ -z "$PIDS" ]; then
  echo "Nothing listening on port ${PORT}."
  exit 0
fi

for pid in $PIDS; do
  echo "Killing PID ${pid} (port ${PORT})..."
  taskkill //PID "$pid" //F 2>&1 || true
done
