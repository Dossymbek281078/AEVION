# Bank prod smoke

End-to-end smoke against the deployed Bank surface — AEV wallet (anonymous,
device-bound) + Auth + QTrade (authed, owner-scoped). Closes Master Plan
P1-6.

The harness lives at
`aevion-globus-backend/scripts/bank-prod-smoke.js` and is wired as
`npm run smoke:bank-prod`.

## What it walks

19 steps across three flows:

**AEV layer** (anonymous, device-bound):

1. `GET /api/aev/stats` — baseline (read-only)
2. `POST /api/aev/wallet/:device/mint` — mint 0.5 AEV
3. `POST /api/aev/wallet/:device/mint` — mint 1.25 AEV
4. `POST /api/aev/wallet/:device/sync` — upsert with mode flags
5. `POST /api/aev/wallet/:device/spend` — spend 0.75 AEV
6. `POST /api/aev/wallet/:device/spend` — overspend (expects 409 `insufficient_funds`)
7. `GET /api/aev/ledger/:device` — tail with limit
8. `GET /api/aev/wallet/:device` — snapshot
9. `GET /api/aev/wallet/x` — invalid deviceId (expects 400)

**Auth** (Tier 2 surface, JWT + tokenVersion + sid):

10. `POST /api/auth/register` — fresh `smoke+<ts>@aevion.test` user
11. `GET /api/auth/me` — bearer round-trip

**QTrade** (owner-scoped via `req.auth.email`):

12. `POST /api/qtrade/accounts` — create acc1
13. `POST /api/qtrade/accounts` — create acc2
14. `POST /api/qtrade/topup` — fund acc1 (100, with Idempotency-Key)
15. `POST /api/qtrade/transfer` — acc1 → acc2 (35)
16. `GET /api/qtrade/transfers` — list mine
17. `GET /api/qtrade/cap-status` — daily caps (topup + transfer)
18. `GET /api/qtrade/summary` — owner aggregate

**Cleanup:**

19. `DELETE /api/auth/account` — remove the smoke user (the QTrade
    accounts/wallets persist; ledger is bounded append-only)

## How to run

Default `BASE` is the latest Vercel public URL plus the `/api-backend`
rewrite, so the smoke validates the full prod path
**browser → Vercel → Railway → Express → mounted router**:

```bash
cd aevion-globus-backend
npm run smoke:bank-prod
```

Override defaults via env:

```bash
# Pin to a specific deploy
BASE=https://aevion-<hash>-aevion.vercel.app/api-backend npm run smoke:bank-prod

# Skip the Vercel rewrite, hit Railway directly
BASE=https://aevion-production-a70c.up.railway.app npm run smoke:bank-prod

# Capture a HAR-ish artifact for diff/audit
ARTIFACT=docs/bank/SMOKE_PROD_$(date +%Y%m%d-%H%M%S).json npm run smoke:bank-prod
```

To get the latest deploy URL programmatically:

```bash
ID=$(gh api repos/Dossymbek281078/AEVION/deployments \
  --jq '[.[] | select(.environment=="Production")] | .[0].id')
gh api repos/Dossymbek281078/AEVION/deployments/${ID}/statuses \
  --jq '.[0].environment_url'
```

## Latest run

`SMOKE_PROD_20260503-215431.json` — 19/19 PASS against
`https://aevion-8bxyonhba-aevion.vercel.app/api-backend` (commit `d2aaeba`,
post-PR #91 i18n SSR fix).

Latency snapshot (ms, single run, Vercel rewrite path):

| Step                              | Status | ms  |
| --------------------------------- | -----: | --: |
| AEV baseline /stats               |    200 | 645 |
| AEV mint 0.5                      |    200 | 621 |
| AEV mint 1.25                     |    200 | 415 |
| AEV sync                          |    200 | 303 |
| AEV spend 0.75                    |    200 | 410 |
| AEV spend 999 (insufficient)      |    409 | 422 |
| AEV ledger tail                   |    200 | 416 |
| AEV wallet snapshot               |    200 | 413 |
| AEV invalid deviceId              |    400 | 391 |
| auth register                     |    201 | 352 |
| auth /me                          |    200 | 269 |
| qtrade create acc1                |    201 | 313 |
| qtrade create acc2                |    201 | 251 |
| qtrade topup 100                  |    200 | 438 |
| qtrade transfer 35                |    200 | 277 |
| qtrade transfers list             |    200 | 281 |
| qtrade cap-status                 |    200 | 265 |
| qtrade summary                    |    200 | 278 |
| auth /account DELETE              |    200 | 399 |

P50 ≈ 391 ms, max ≈ 645 ms (cold AEV stats fetch). Acceptable for a
cross-region path through Vercel → Railway.

## Pollution

Each run registers ONE user (`smoke+<ts>@aevion.test`) and self-cleans via
`DELETE /api/auth/account`. AEV wallet entries and the QTrade in-memory
accounts persist; the AEV ledger is bounded append-only at 50k entries.

If the smoke ever leaves a stale smoke user behind (e.g. crash mid-run),
clean it up via SQL on the prod DB or call DELETE manually with that
user's token.

## Failure triage

The harness exits 1 on the first failure and prints the offending step's
status + truncated body. The artifact JSON includes every request/response
with `durMs` so a flaky step can be inspected without re-running.

If all AEV steps fail with the same status (e.g. 401 across the board),
the wallet ownership-binding has likely been hardened to require Bearer
on every write — adjust the harness to register first, then mint with
`Authorization: Bearer <token>`.
