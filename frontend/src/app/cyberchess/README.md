# AEVION CyberChess

> The chess training platform that gives you points even when you lose — if you played well.

**Status:** post-MVP, beat lichess + chess.com · **Live:** [aevion.app/cyberchess](https://aevion.app/cyberchess) · **Code:** `frontend/src/app/cyberchess/`

---

## What is it?

CyberChess is AEVION's chess platform built around a **composite rating system (CPI — Chess Performance Index)** that measures the *quality* of your play across **11 factors**, not just match outcomes.

Where lichess.org and chess.com use Glicko/Elo (result-only), AEVION CPI awards points for:
- Centipawn-loss precision
- Time management
- Opening book accuracy
- Engine-line matching (1st/2nd/3rd choice)
- Mate-in-N vision (1, 2, 3)
- Hang avoidance
- Brilliancy detection
- Plus a small result bonus

**You can earn rating points after losing a game** if your CPL was low and you found a mate-in-3.
**You can lose rating points after winning a game** if you blundered your queen.

The composite score better reflects skill growth than any result-only system.

---

## Why it beats lichess + chess.com

| Feature                                            | lichess  | chess.com | AEVION CyberChess |
| -------------------------------------------------- | -------- | --------- | ----------------- |
| Composite CPI rating (11 factors)                  | ❌       | ❌        | ✅                |
| Points for losses if quality high                  | ❌       | ❌        | ✅                |
| Leaderboard ranked by ANY factor                   | ❌       | ❌        | ✅                |
| Coach auto-picks weak-zone drills                  | ❌       | partial   | ✅                |
| AEV-native currency (Chessy)                       | ❌       | ❌        | ✅                |
| Auction of lessons, coach rental, streamer subs    | ❌       | ❌        | ✅                |
| Picture-in-Picture stream over board               | ❌       | ❌        | ✅                |
| Spaced-repetition Coach knowledge                  | ❌       | partial   | ✅                |
| 12 chess variants (Atomic, KotH, Twin Kings, ...)  | partial  | partial   | ✅                |
| Game DNA / Game Insights AI cards                  | ❌       | partial   | ✅                |
| Ghost Duel (vs your past-self)                     | ❌       | ❌        | ✅                |
| Multiverse mode (parallel alt-history)             | ❌       | ❌        | ✅                |
| Stockfish 18 NNUE multi-threaded (open-source)     | ✅       | ✅        | ✅                |

**9 unique killer features** that don't exist on the other two.

---

## Routes

| Path                                  | What |
| ------------------------------------- | ---- |
| `/cyberchess`                         | Main game — play vs AI, multi-variant, OnboardingOverlay, SR Coach reminders, Chessy billing |
| `/cyberchess/cpi`                     | CPI specification — formula + factor breakdown + comparison with Elo |
| `/cyberchess/cpi/dashboard`           | Personal CPI dashboard — history graph, factor breakdown, weak-zone callout |
| `/cyberchess/cpi/leaderboard`         | Public ranking by CPI — sort by any of 9 quality factors |
| `/cyberchess/economy`                 | Chessy economy — auction, coach rental, streamer subs |
| `/cyberchess/training`                | Daily training plan — weak factor drill + variant of day + SR reminders |
| `/cyberchess/tournament`              | Tournament hub — bracket viz, leaderboard, badges |

All pages are mobile-responsive, JSON-LD structured-data tagged, and OG-image enabled.

---

## Architecture

```
frontend/src/app/cyberchess/
├── page.tsx                    # 10K-line main game (board, AI, variants, billing, ...)
├── cpi.ts                      # CPI computation engine + persistence (359 lines)
├── stockfishMetrics.ts         # MetricsCollector for per-move data → CPI
├── variants.ts                 # 12 variant FENs + rule helpers (Knight Riders, Atomic, etc.)
├── tournament.ts               # Bracket / leaderboard / badges logic
├── coachKnowledge.ts           # 93 SM-2 entries + 1/3/7-day reminders data layer
├── OnboardingOverlay.tsx       # 3-step first-visit (color/AI/time)
├── WorkspacePiP.tsx            # Floating draggable YouTube/Twitch over board
├── billing.ts                  # QPayNet payment-request flow for Chessy tiers
├── powerDrop.ts                # Crazyhouse + PowerDrop variant pool
├── brilliancy.ts               # Brilliant-move detector
├── insights.ts                 # Post-game insights
├── personality.ts              # AI rival personality system
├── ghostDuel.ts                # Replay vs past-self
├── gameDna.ts                  # Visual game pattern analysis
├── coordTrainer.ts             # Board coordinate trainer
├── openingExplorer.ts          # Lichess opening DB integration
├── tablebase.ts                # 7-piece endgame tablebase queries
├── boardEditor.ts              # FEN editor
├── coachLessons.ts             # Structured lesson plans
├── CoachKnowledgeModal.tsx     # Coach UI with weak-factor card
├── ...                          # 30+ more
└── cpi/                        # CPI sub-routes
    ├── page.tsx                # Spec preview
    ├── dashboard/page.tsx      # Personal dashboard
    └── leaderboard/page.tsx    # Public leaderboard
```

---

## Key Tech

- **Engine**: Stockfish 18 lite NNUE multi-threaded (`stockfish-18-lite.{js,wasm}`) — same evaluation as lichess, runs in browser
- **Frontend**: Next.js 16 App Router, TypeScript strict, inline styles (dark slate theme)
- **State**: localStorage for everything (CPI history, reminders, achievements, billing) — no backend dependency for core gameplay
- **AI Coach**: Anthropic Claude API via `/api/qcoreai/*` (separate AEVION module)
- **Puzzles**: Bundled 5818 from Lichess CC0 + cloud expansion via `/api-backend/puzzles`
- **Variants**: 12 (standard, Fischer960, asymmetric armies, twinkings, diceblade, reinforcement, atomic, kingofthehill, threecheck, knightriders, pawnapocalypse, powerdrop, crazyhouse)

---

## How CPI works (in 30 seconds)

```text
ΔCPI =   w_E   · E_score        ← 30 (eval-loss precision)
       + w_T   · T_score        ← 5  (time management)
       + w_O   · O_score        ← 10 (opening book hits)
       + w_B   · B1_score       ← 20 (engine #1 line)
       + w_B2  · B2_score       ← 5  (engine #2 line)
       + w_B3  · B3_score       ← 2  (engine #3 line)
       + w_M1  · M1_score       ← 8  (mate-in-1 found rate)
       + w_M2  · M2_score       ← 15 (mate-in-2 found rate)
       + w_M3  · M3_score       ← 20 (mate-in-3 found rate)
       − w_H   · H_count        ← −25 (hangs ≥ 300cp swing)
       + w_Br  · Br_count       ← +30 (brilliancies found)
       + R_bonus                ← +10/+5/0 (W/D/L)

CPI_new = clamp(CPI_old + ΔCPI, 0, 4000)
```

**Examples:**

| Scenario | Elo result | CPI ΔCPI |
| -------- | ---------- | -------- |
| Lost, but CPL 25, found mate-in-3 | −15 | **+88** |
| Won, but hung queen | +15 | **+10** |
| Perfect draw, CPL 8 | 0  | **+50** |

See [`CYBERCHESS_CPI_SPEC.md`](../../../../../CYBERCHESS_CPI_SPEC.md) for full spec.

---

## Tiers (Chessy currency)

- **Free** — base play, 12 variants, basic Coach, puzzles
- **Pro** (500 AEV/mo) — Coach unlimited, deep analysis, master AI level, theme pack
- **Ultimate** (5000 AEV/lifetime) — everything in Pro + cross-account analytics + priority leaderboard

Purchase flow: in-game shop → `createTierPaymentRequest` → opens QPayNet → poll status → grant tier via localStorage.

See [`billing.ts`](./billing.ts).

---

## Stockfish performance

We run **Stockfish 18 lite NNUE multi-threaded** in WebWorker. Hash 1024 MB, threads = `navigator.hardwareConcurrency - 1`.

To verify NNUE + threads in production:
1. Open `/cyberchess` in DevTools console
2. Trigger SF (Analysis tab or AI move)
3. Look for `[SF] info string NNUE evaluation using ...` (NNUE confirmation)
4. Look for `[SF] info string Using N threads` (multi-thread confirmation)

If `N == 1` — SharedArrayBuffer is not available in browser (check COEP/COOP headers).
If no NNUE log — engine fell back to classic eval.

See [`CYBERCHESS_STOCKFISH_UPGRADE.md`](../../../../../CYBERCHESS_STOCKFISH_UPGRADE.md) for upgrade paths.

---

## Roadmap

See [`CYBERCHESS_ROADMAP.md`](../../../../../CYBERCHESS_ROADMAP.md) for the full picture.

**Current state:** Frontend-MVP complete, all 8 phases (F1-F8) shipped. ETA to production: ~5-7 days.

**Next blockers:**
- Backend `/api/cyberchess/cpi/leaderboard` (cross-zone request open with frontend-qcore)
- Backend `cyberchess_cpi_state` Postgres table
- Stockfish Level 3 (migration to lila-stockfish-web for true lichess-grade)
- Mobile playboard polish (board itself, not surrounding UI)
- Playwright E2E for 12 variants

---

## Files & contracts

| Public API | What it exports |
| ---------- | --------------- |
| `cpi.ts` | `computeGameCPI`, `applyGameToCPI`, `ldCPIState`, `svCPIState`, types: `GameMetrics`, `CPIBreakdown`, `CPIState`, `CPIWeights`, `DEFAULT_WEIGHTS` |
| `stockfishMetrics.ts` | `MetricsCollector`, `computeCPL`, `parseMultiPVLine`, types: `MoveMetric`, `PVLine` |
| `variants.ts` | `VARIANTS`, FEN helpers per variant, `twinKingsLossSideByCaptures`, `kothWinner`, `applyExplosion`, `filterMovesByDice`, `pickReinforcement`, ... |
| `tournament.ts` | `createTournament`, `applyPlayerResult`, `advanceBracket`, `finalPlace`, `placeReward`, `buildBracket`, `bracketAscii`, `awardBadges`, `computeTournamentLeaderboard` |
| `coachKnowledge.ts` | 93 entries, `findEntryById`, `entriesByDifficulty`, `ldReminderState`, `markFirstStudy`, `dismissReminder`, `getDueReminders` |
| `WorkspacePiP.tsx` | `WorkspacePiP` (default), `useWorkspacePiP`, `detectMediaSource` |
| `OnboardingOverlay.tsx` | `OnboardingOverlay`, `hasCompletedOnboarding`, `markOnboardingDone` |
| `billing.ts` | `createTierPaymentRequest`, `pollPaymentRequest` |

---

## Local dev

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000/cyberchess
```

For backend (CPI sync, leaderboard, etc.):
```bash
cd aevion-globus-backend
npm install
npm run dev
# → http://localhost:4001 (proxied via Next config)
```

Smoke tests:
```bash
cd aevion-globus-backend
node scripts/cyberchess-smoke.js
```

---

## License

Stockfish: GPLv3 (vendored from [github.com/nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js))
Coach Knowledge content: original to AEVION
Lichess Puzzle DB: CC0 (public domain)
Application code: AEVION proprietary (subject to AEVION ToS)

---

## Contributing

See `AEVION_COORDINATION.md` in repo root. **This directory (`frontend/src/app/cyberchess/`) is owned by the `aevion-core/main` session per LIVE ZONE OWNERSHIP rules.**

Cross-zone changes require a 30-minute Pending request window. Use `git commit --only -- <file>` to avoid sweeping up other sessions' work.

Maintained by Dossymbek + Claude Code (Anthropic).
