# scripts/

Repo-wide dev tooling. Most files here are one-off/topic-specific (see
`README-*.md` for those); this file indexes the small generic helpers meant
to be reused across any AEVION app in this monorepo.

- **`stop-dev-port.sh [port]`** (default 3000) — kills whatever is actually
  listening on a dev-server port, by its real Windows PID. Use this instead
  of `pkill -f "next dev"` on Windows + Git Bash: MSYS's `ps`/`pkill` see a
  different PID namespace than the native Windows PID that `netstat`/
  `taskkill` operate on, so name-based kills routinely miss the real
  listener and leave an orphaned server bouncing every subsequent
  `npm run dev` onto the next free port instead of reusing 3000.

- **`audit-tick-setstate.mjs [root-dir]`** (default `frontend/src`) — scans
  for `setInterval(...)` call sites whose body calls a `useState`-setter-
  shaped function (`setFoo(`/`sFoo(`). Flags candidates for review, not a
  hard gate: a fast tick inside a small isolated component is fine, the
  risk is a large page-level component re-rendering its whole tree on every
  tick for as long as the interval runs. Written after finding exactly that
  bug four times in one day across CyberChess (PR #721, #740, #746).
