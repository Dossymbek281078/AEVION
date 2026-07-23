# QSkyway — Session Handoff (2026-07-22)

> Worktree: `C:\Users\user\aevion-qskyway`. Session scope was explicitly QSkyway-only
> (user confirmed, see memory `project_qskyway_aerotaxi.md` — "аэротакси" = QSkyway).
> Root `CLAUDE.md` and `HANDOFF.md` in this worktree are **stale/shared with other
> modules** (smeta-trainer / CyberChess content) — ignore them, this file is the
> real state for QSkyway as of this session.

## What shipped (9 PRs, all merged + prod-verified)

| PR | What |
|---|---|
| #741 | Vertiport-suitability panel + 4D slots-market panel (client reads already-fetched `/city` data + new `GET /slots` call) |
| #749 | Synced stale header comment (`qskyway.ts`) + `projects.ts` description with actually-shipped code (3 cities, Postgres-optional persistence, Phase 5 done) |
| #758 | Persist/ephemeral badge on the slots-market panel (`store: postgres` vs `memory`) |
| #770 | Hero flight now calls real backend `POST /route` (obeys no-fly + wind ETA) instead of duplicating A* client-side; fixed a latent stale-closure bug (`cityIdRef`) that would've permanently sent the city active at mount to the backend after switching cities |
| #782 | Ed25519 badge is now clickable — fires real `GET /verify`, shows ✓/✗ instead of just displaying an unverified hash |
| #793 | Route-level confidence metrics (`heightConfidencePct`, `avgConfClearM`) surfaced in the Telemetry panel — previously fetched and discarded |
| #801 | Wind's ETA delta (`etaMinStill` vs `etaMinWind`) shown next to the flight time |
| #817 | Per-vertiport detail line (`openRadiusM`/`clearanceM`/`distNoFlyM`) — same "computed but discarded" pattern as #793 |
| #836 | Fixed `qskyway-smoke.js`: hardcoded `routeId: "smoke-route-1"` collided with slots from earlier prod runs once the store went Postgres-persistent; now unique per invocation |

## Verified state (2026-07-22, end of session)

- **Smoke suite**: `node scripts/qskyway-smoke.js` (also runnable with `BASE=https://api.aevion.app`) — 44/44 PASS. Prod runs occasionally show 1 transient failure (cold-start/deploy-window blip, this backend deploys very frequently from parallel sessions) — always re-run once before treating a failure as real; none reproduced on a second run this session.
- **Live click-tested on prod** (`aevion.app/qskyway`) in both English and Russian, all three cities (Astana/NYC/Tokyo): city switch, new-flight backend routing, Ed25519 verify, slot booking, vertiport panel, slots-market panel. All correct.
- **Prod Postgres confirmed wired**: `DATABASE_URL` present in Railway service vars (checked via browser, value not read); `curl https://api.aevion.app/api/qskyway/slots` → `"store":"postgres"`.

## Known non-issues (investigated, ruled out)

- A single NYC routing pair failed once in a smoke run — did not reproduce on a targeted re-check of all 42 pairs nor a full re-run. Transient.
- Slot-booking count assertion failed against prod before #836 — root cause was the fixed `routeId` colliding with prior runs' bookings, not a product bug. Fixed.

## Real bug found — NOT fixed, out of scope

**Platform-wide translation-runtime bug**, not QSkyway-specific: switching city (or any client-side re-render without a full page reload) in a non-Russian locale sometimes concatenates the *old* translated text with the *new* one instead of replacing it (e.g. wind reading, vertiport suitability score, distance-to-no-fly-zone all showed glued-together old+new values in English; same actions in Russian — no translation layer needed — produced perfectly clean data matching the raw backend API 1:1). Confirmed the bug is in whatever DOM-translation layer AEVION runs (the "AI: Cloud" header badge / 11-language switcher), not in QSkyway's React state or the backend. User explicitly said to leave this alone this session — see memory `bug_translation_concat_on_rerender.md`. Worth a dedicated investigation in a future session since it likely affects other pages with similar client-side dynamics, not just QSkyway.

## What's next (not started)

- **Regulator feed adapter (FAA/EASA/CAAC + METAR)** — the code's own disclaimer names this as the real next phase (no-fly zones/wind are currently illustrative). Needs external API credentials the assistant did not have access to this session; user deferred it explicitly.
- Everything else from the original code-audit (unused `/health` and `/vertiports` standalone endpoints, `avoidsNoFly` field) was judged low-value or already covered via the embedded `/city` data and was not pursued further.

## Operational note (adjacent, not acted on)

Railway's notification bell showed dozens of "Deployment crashed" events for the AEVION backend service over a few hours during this session, while the live deployment itself stayed healthy (`ACTIVE` / `Deployment successful`). Very likely a transient crash-on-cold-start + auto-restart pattern (Restart Policy: On Failure) given how frequently this shared backend redeploys from many parallel sessions — not investigated further, platform-wide and outside this session's QSkyway-only scope.
