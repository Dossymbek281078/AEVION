# Session handoff — 2026-05-03 evening (bank track)

Pick up the AEVION bank-track work on another laptop. Read this top to
bottom; everything you need is linked.

---

## How to restart on the other laptop (PowerShell)

```powershell
# 1. Clone the repo if it isn't there yet
cd C:\Users\user
if (-Not (Test-Path .\aevion-core)) {
  git clone https://github.com/Dossymbek281078/AEVION.git aevion-core
}

# 2. Make sure the frontend-bank worktree exists
cd C:\Users\user\aevion-core
if (-Not (Test-Path ..\aevion-core\frontend-bank)) {
  git worktree add ..\aevion-core\frontend-bank main
}

cd C:\Users\user\aevion-core\frontend-bank
git fetch --prune origin
git checkout main
git pull --ff-only origin main

# 3. Install deps for both halves of the monorepo
npm install --include=optional
npm install --include=optional --prefix aevion-globus-backend
npm install --include=optional --prefix frontend

# 4. Verify the world is green
npm run verify   # backend tsc + integration + frontend next build

# 5. Launch Claude Code in this directory
claude
```

Paste this into Claude as the first message:

> Read `SESSION_HANDOFF_2026-05-03.md`, then `docs/AEVION_MASTER_PLAN.md` § 5
> for the `aevion-bank` window. Pick the top unblocked item and propose
> the smallest next PR-sized step.

The auto-memory at
`C:\Users\user\.claude\projects\C--Users-user-aevion-core\memory\MEMORY.md`
already carries forward the user profile, prod URLs, the use-client-data
boundary lesson, and the cross-window protocol — Claude on the new laptop
reads it automatically.

---

## What landed in this session

| PR  | Branch                              | What                                                                                                |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| #91 | `fix/i18n-server-client-boundary`   | Split `i18n.tsx` data dict into `i18n-data.ts` so SSR can read it. Fixes 5 SSR 500s on prod (`/globus`, `/qbuild`, `/qtradeoffline`, `/aevion-ip-bureau`, `/awards`). |
| #103 | `feat/bank-prod-smoke`             | `npm run smoke:bank-prod` — 19-step end-to-end harness against prod via Vercel rewrite. AEV + Auth + QTrade. 19/19 PASS. |
| #105 | `docs/master-plan-p1-6-done`       | Mark Master Plan P1-6 done; refresh § 5 next-task list for `aevion-bank` window.                   |

All three merged into `main` and auto-deployed by Vercel + Railway.

---

## Current prod state

- **Vercel project**: `aevion/aevion` (the monorepo; **NOT** `aevion.io`).
- **Vercel SSO**: disabled. Public URLs reachable.
- **Latest public deploy URL (rotates per push)** — fetch with:

  ```powershell
  $ID = & 'C:\Program Files\GitHub CLI\gh.exe' api `
    repos/Dossymbek281078/AEVION/deployments `
    --jq '[.[] | select(.environment=="Production")] | .[0].id'
  & 'C:\Program Files\GitHub CLI\gh.exe' api `
    repos/Dossymbek281078/AEVION/deployments/$ID/statuses `
    --jq '.[0].environment_url'
  ```

- **Railway backend** (direct, ungated): `https://aevion-production-a70c.up.railway.app`
- **Frontend smoke matrix**: 22/22 pages green (was 19/22 before PR #91).
- **Bank smoke**: 19/19 green via `npm run smoke:bank-prod`. Latest
  artifact in `docs/bank/SMOKE_PROD_20260503-215431.json`.

---

## What's next (per Master Plan § 5 · `aevion-bank`)

1. **AEC ↔ fiat boundary doc** — required before P3-4 (first paid Bureau
   cert via Stripe). Pure documentation, ~45 min.
2. **Resolve `bank-payment-layer` branch** — currently 1 commit ahead of
   main with cyberchess diag; decide merge vs delete. ~15 min.
3. **Wire `npm run smoke:bank-prod` into the daily cron** — harness
   shipped in #103, just needs hooking into `scripts/all-smokes.js`
   orchestrator.

Cross-window risks to watch (open PRs at session close):

- **#95** `polish/i18n-kk-parity` — touches `i18n` files. After my PR #91,
  `i18n.tsx` is now 11 lines (re-export shell) and the data dict lives in
  `i18n-data.ts`. The other window will need to rebase #95 on top of #91
  — heads-up before reviewing.
- **#96** `feat(qcore): V7` — frontend-qcore window, no overlap with bank.

---

## Key files touched this session

- `frontend/src/lib/i18n.tsx` — slim wrapper, re-exports from `i18n-data`.
- `frontend/src/lib/i18n-data.ts` — new, holds Lang/translations/interpolate.
- `frontend/src/lib/i18n-server.ts` — imports from `i18n-data` directly.
- `aevion-globus-backend/scripts/bank-prod-smoke.js` — new smoke harness.
- `aevion-globus-backend/package.json` — `smoke:bank-prod` npm script.
- `docs/bank/SMOKE_PROD.md` — how to run + latency table.
- `docs/bank/SMOKE_PROD_20260503-215431.json` — first green run artifact.
- `docs/AEVION_MASTER_PLAN.md` — P1-6 marked done, § 5 refreshed.

---

## Hard rules carried over (from `CLAUDE.md` + auto-memory)

- Reply in Russian; keep code/identifiers/commit messages in English.
- Default-yes — don't ask yes/no questions, just push through phases.
- Auto commit + push + PR + merge + redeploy when a block completes.
- Never `git push --force` to main.
- Always run `npm run verify` before "done".
- Don't import data from a `"use client"` module into server code (memory
  `feedback_use_client_data_boundary.md`) — Next 16 + Turbopack turns
  non-component exports into opaque stubs across the boundary.
- For `bank-payment-layer` ↔ main conflicts, resolve via PR review only —
  not local merge (memory `feedback_main_merge_via_pr_only.md`).
