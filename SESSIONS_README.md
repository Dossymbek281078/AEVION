# AEVION — 10 parallel sessions plan (next-day kickoff)

> Last updated: 2026-04-26. Use this with `START_SESSIONS.ps1`.

## TL;DR

**From PowerShell (most common):**
```powershell
& "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
```

If you get an "execution policy" error:
```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force; & "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
```

**From cmd.exe** (or Run dialog Win+R):
```cmd
powershell -ExecutionPolicy Bypass -File "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
```

> Why two forms? Inside PowerShell, `-ExecutionPolicy` is a parameter of `powershell.exe`, not a top-level command — typing it directly produces "Имя -ExecutionPolicy не распознано". The `&` call operator runs the script in the current shell. From cmd, `powershell` is the executable, so flags work.

This opens 10 sessions (Windows Terminal tabs if available, otherwise 10 PowerShell windows). Each tab is pre-configured with its own working directory and prints a brief on launch. Then **type `claude` in each tab** to start the agent.

The script is idempotent — safe to re-run. Worktrees that already exist are reused, never recreated.

---

## Group A — Continuing tracks (5 tabs · all in `frontend-bank/` · branch `bank-payment-layer`)

These pick up work we shipped today (PR #5). Same worktree, same branch — split by topic so each Claude session has clean context.

| # | Title | Topic | First prompt to give Claude |
|---|-------|-------|------------------------------|
| A1 | Bank polish | Final QA + responsiveness + a11y before merge | *"Read BANK_HANDOFF.md and run a polish sweep on /bank: mobile responsiveness, axe accessibility audit, Lighthouse perf, fix any P1 issues. Don't refactor."* |
| A2 | Pitch evolution | Add case-study quotes, real partner logos when available, video links | *"Read src/data/pitchModel.ts and src/app/pitch/page.tsx. Add a 'Customer voice' section with 3 quoted case studies (placeholder text I'll fill in later) and a 'Press / mentions' band. Keep dark aurora style."* |
| A3 | Demo refresh | Align /demo and /demo/deep with the new pitchModel narrative | *"Read src/app/demo/page.tsx, /demo/deep/page.tsx, and src/data/{pitchModel,demoNarrative,demoDeep}.ts. Refresh /demo to mirror the new investor numbers ($340B TAM, 12 live MVPs, etc.) and fill /demo/deep with architecture diagrams + threat model + perf budgets."* |
| A4 | Multichat → live | Take Multichat Engine from beta to live MVP | *"Read src/app/multichat-engine/page.tsx and the QCoreAI chat backend. Ship parallel-session UI, role isolation per agent, persistence, white-label B2B preview. Update pitchModel stage 'beta' → 'live' once shipped."* |
| A5 | Awards UX | Real submission/voting/payout flow for Music + Film | *"Read src/app/awards/{page,music/page,film/page}.tsx and the AwardPortal component. Build real submission form, voting UI tied to Planet validators, leaderboard, AEC payout preview tied to Bank."* |

After each track ships, run `npm run verify` from `aevion-core` root before opening a new commit.

---

## Group B — New tracks (5 tabs · 5 new worktrees · 5 new branches from `main`)

Each gets its own worktree under `C:\Users\user\aevion-core\` so branches don't collide.

| # | Title | Worktree | Branch | First prompt to give Claude |
|---|-------|----------|--------|------------------------------|
| B1 | Globus polish | `frontend-globus/` | `globus-polish` | *"Read frontend/src/app/page.tsx (the homepage / Globus map, 998 lines — read carefully before editing). Build an interactive 3D / SVG map of the 27 nodes; clicking a node opens a live status drawer. Pull /api/globus/projects in real time. Align hero numbers with /pitch."* |
| B2 | AEC Exchange | `frontend-exchange/` | `aec-exchange` | *"Design and ship `/exchange` — an order book for AEC ↔ module-credit pairs (royalty credit, chess credit, planet credit). AMM-style pricing for thin order books. Treasury controls. Ship behind a feature flag. Propose backend contract /api/exchange/{book,quote,trade} as a written spec for the backend session."* |
| B3 | Payments rail | `frontend-payments/` | `payments-rail` | *"Read frontend/src/app/bank/_components/SendForm.tsx and _lib/api.ts. Extract a unified send-money primitive used by every module. Consolidate recurring + scheduled + split + gift modes. Build a settlement audit log + reconciliation report. Real-time balance everywhere."* |
| B4 | GTM (pricing + API docs) | `frontend-gtm/` | `gtm-pricing-api` | *"Build /pricing — tiered (Free / Pro / Enterprise) per module bundle, aligned with pitchModel.ts revenue lines. Then build /api-docs — read /api/openapi.json and render a clean docs viewer with try-it console. Add partner-program landing."* |
| B5 | Chess tournaments | `frontend-chess/` | `chess-tournaments` | *"Read frontend/src/app/cyberchess/page.tsx (1137 lines — chess engine first, then tournaments). Build tournament creation, brackets, live spectating, AEC entry fees, Trust-Score-gated brackets, anti-cheat hooks via Trust Graph, prize-pool auto-payout to Bank."* |

---

## Worktree plumbing

Each Group-B worktree is created automatically by `START_SESSIONS.ps1`. If you ever need to inspect or remove them manually:

```powershell
cd C:\Users\user\aevion-core
git worktree list                 # show all worktrees
git worktree remove ../frontend-globus    # remove one (after committing/pushing!)
```

---

## Recommended order to merge back to `main`

1. **Bank PR #5** (today's work) — already at https://github.com/Dossymbek281078/AEVION/pull/5 — merge first so `main` carries pitch + bank.
2. **Globus polish (B1)** — depends on /pitch numbers being on main; biggest investor-visible win.
3. **GTM (B4)** — pricing + API docs are required for partner conversations.
4. **Payments rail (B3)** — hardens the cross-module money story.
5. **Multichat → live (A4)** — promotes a beta module to live; visible upgrade.
6. **AEC Exchange (B2)** — keep behind feature flag until product validated.
7. **Chess tournaments (B5)** — engagement multiplier; ship after rails are firm.
8. Continuing polish tracks (A1, A2, A3, A5) — merge as PRs whenever ready.

---

## Daily checklist for any session

Before opening a PR for a session's branch, run from `aevion-core` root:

```bash
npm run verify        # backend tsc + frontend next build
```

After merge to `main`, immediately rebase the other worktrees:

```powershell
foreach ($wt in @("frontend-globus","frontend-exchange","frontend-payments","frontend-gtm","frontend-chess","frontend-bank")) {
  Push-Location "C:\Users\user\aevion-core\$wt"
  git fetch origin ; git rebase origin/main
  Pop-Location
}
```

---

## Memory + context for any new session

Each Claude session inherits:

- Global memory: `C:\Users\user\.claude\projects\C--Users-user-aevion-core\memory\MEMORY.md` (loaded automatically) — has user prefs, project decisions, scope notes.
- `aevion-globus-backend/CLAUDE.md` — backend rules.
- `frontend-bank/CLAUDE.md` — bank rules (only relevant to Group A).
- For Group B worktrees: no per-track CLAUDE.md exists yet. Consider adding one per worktree on the first Claude session there ("we work on X module only, don't touch Y").

---

## Quick troubleshooting

- **Windows Terminal didn't open 10 tabs** — script falls back to 10 separate PowerShell windows. Install Windows Terminal from Microsoft Store for a nicer experience.
- **Worktree creation failed** — run `git worktree list` to see existing ones; manually remove broken ones with `git worktree remove --force <path>`.
- **`claude` command not found** — install Claude Code: `npm install -g @anthropic-ai/claude-code`.
- **`npm install` fails on Windows** — always use `npm install --include=optional` (Windows drops Linux-only optional deps from the lockfile, breaking subsequent CI).
