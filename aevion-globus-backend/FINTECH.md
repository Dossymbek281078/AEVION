# AEVION Fintech Subsystem

Internal-facing README for the fintech surface of the AEVION backend. Targeted at backend developers and ops — not end users. Read `AEVION_COORDINATION.md` before touching any file referenced here.

---

## 1. Overview

The AEVION fintech ecosystem is the money-and-trust spine of the platform. It is composed of **five backend modules** that wire together via a single fire-and-forget event helper (`src/lib/ecosystemEvents.ts`). Every value-moving action on the platform — a QPayNet deposit, a Bureau certificate upgrade, a QGood donation, a QMaskCard charge — terminates in two side-effects: an append to the **VeilNetX Ledger** (the canonical, Merkle-chained, HMAC-blinded record of value) and an emission on **Z-Tide** (the reputation graph). QChainGov layers governance on top (community proposals weighted by Z-Tide rank), and QMaskCard provides the privacy-preserving payment surface. The cross-product chain is intentionally asymmetric: callers never await ledger or reputation writes, and helpers never throw — fintech side-effects must not block the primary response path.

The five modules:

| # | Module | Role |
|---|---|---|
| 1 | **VeilNetX Ledger** | Canonical append-only Merkle-chained value log |
| 2 | **Z-Tide** | Reputation events + 7-tier rank ladder |
| 3 | **QChainGov** | Proposal/vote governance with Z-Tide weighting |
| 4 | **QMaskCard** | Virtual PANs with AI fraud-score gating |
| 5 | **QGood** | Donation campaigns + admin-funded matching pools |

---

## 2. The 5 modules

### 2.1 VeilNetX Ledger

**Purpose.** Canonical, append-only value ledger. Every entry is hash-chained to the previous one (Merkle-style), and participant identifiers are HMAC-blinded with a server-side salt so the ledger is auditable without leaking PII.

**Route file.** `src/routes/veilnetxLedger.ts`

**Database tables.**

| Table | Notable columns |
|---|---|
| `VeilNetXLedger` | `id`, `seq`, `module`, `kind`, `fromHash`, `toHash`, `amountCents`, `currency`, `prevHash`, `entryHash`, `meta`, `createdAt` |

**Public endpoints (read-only, no auth).**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/veilnetx-ledger/entries` | Paginated list with module/kind filters |
| GET | `/api/veilnetx-ledger/entries/:id` | Single entry by id |
| GET | `/api/veilnetx-ledger/chain/head` | Latest seq + entryHash (the chain tip) |
| GET | `/api/veilnetx-ledger/chain/verify` | Recompute hashes, return `integrity: ok\|broken` |
| GET | `/api/veilnetx-ledger/search` | Full-text-ish search across module/kind/meta |
| GET | `/api/veilnetx-ledger/stats` | Counts per module/kind, last 24h volume |
| GET | `/api/veilnetx-ledger/health` | Liveness probe |

**Auth-gated endpoints (Bearer JWT).**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/veilnetx-ledger/entries` | Manual write. Most callers use `emitVeilNetXEntry()` instead. |

**Admin endpoints.** None — this module is read-mostly and write-via-helper.

**Cross-product hooks.** Pure sink — VeilNetX Ledger emits nothing. It is the terminus of the event chain. Every other module writes here via `emitVeilNetXEntry()`.

**Env.** `VEILNETX_SALT` is the HMAC key for participant blinding; falls back to `SHARD_HMAC_SECRET` if unset. **Set one of these in prod** — otherwise blinding uses a development default and re-deploys can break participant correlation.

---

### 2.2 Z-Tide

**Purpose.** Reputation graph. Records weighted events (deposits, donations, governance votes, cert upgrades, login streaks, etc.) and maintains a per-user cumulative score that maps to a **7-tier rank ladder** (Drift → Eddy → Current → Stream → Surge → Tidal → Maelstrom).

**Route file.** `src/routes/ztide.ts`

**Database tables.**

| Table | Notable columns |
|---|---|
| `ZTideEvent` | `id`, `userId`, `kind`, `sourceModule`, `weight`, `meta`, `createdAt` |
| `ZTideScore` | `userId` (PK), `score`, `rank`, `lastEventAt`, `loginStreakDays` |

**Public endpoints (read-only, no auth).**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/ztide/leaderboard` | Top N by score |
| GET | `/api/ztide/rank/:userId` | Public rank/score for one user |
| GET | `/api/ztide/stats` | Global counters, rank-distribution histogram |

**Auth-gated endpoints (Bearer JWT).**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/ztide/me` | Caller's score, rank, recent events |
| POST | `/api/ztide/me/login-streak` | Tick today's login (idempotent per UTC day) |

**Service-or-admin endpoints.**

| Method | Path | Auth |
|---|---|---|
| POST | `/api/ztide/events` | Bearer + admin-email, **OR** `X-ZTide-Service-Key: $ZTIDE_SERVICE_KEY` |

**Admin env.** `ZTIDE_ADMIN_EMAILS` (comma-separated), `ZTIDE_SERVICE_KEY` (single shared secret for service-to-service writes).

**Cross-product hooks.** Pure sink for reputation. Receives writes from QPayNet, Bureau, QGood, QChainGov, QMaskCard via `emitZTideEvent()`. The 10 event kinds and their default weights are defined inline in `ztide.ts` — see `EVENT_WEIGHTS`.

---

### 2.3 QChainGov

**Purpose.** Proposal-and-vote governance. Anyone with a wallet can submit; voting is Z-Tide-weighted; admins control lifecycle transitions and execution.

**Route file.** `src/routes/qchaingov.ts`

**Database tables.**

| Table | Notable columns |
|---|---|
| `QChainGovProposal` | `id`, `authorUserId`, `title`, `body`, `voteMode`, `status` (`draft\|open\|closed\|executed\|rejected`), `openedAt`, `closesAt`, `executedAt`, `tallyYes`, `tallyNo`, `tallyAbstain` |
| `QChainGovVote` | `id`, `proposalId`, `voterUserId`, `choice` (`yes\|no\|abstain`), `weight`, `meta`, `createdAt` |

`voteMode` ∈ `{ one-person-one-vote, ztide-weighted, quadratic }`.

**Public endpoints (read-only, no auth).**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/qchaingov/proposals` | Paginated, filterable by status |
| GET | `/api/qchaingov/proposals/:id` | Single proposal + tally |
| GET | `/api/qchaingov/proposals/:id/votes` | Voter list (userId hashed) |
| GET | `/api/qchaingov/stats` | Counts by status, top proposals |

**Auth-gated endpoints (Bearer JWT).**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/qchaingov/proposals` | Submit (lands in `draft`) |
| POST | `/api/qchaingov/votes` | Cast a vote on an `open` proposal |

**Admin endpoints (`QCHAINGOV_ADMIN_EMAILS`).**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/qchaingov/proposals/:id/open` | `draft → open`, sets `closesAt` |
| POST | `/api/qchaingov/proposals/:id/close` | `open → closed`, freezes tally |
| POST | `/api/qchaingov/proposals/:id/execute` | `closed → executed\|rejected` |

**Cross-product hooks.** On vote-cast: `emitZTideEvent({ kind: 'qchaingov-vote', sourceModule: 'qchaingov' })` (+1). On proposal-execute: `emitVeilNetXEntry({ module: 'qchaingov', kind: 'governance' })` (amount = 0, meta = decision).

---

### 2.4 QMaskCard

**Purpose.** Virtual-PAN issuance and charging. Each mask is a single-use or scoped card number that fronts a real funding source. AI fraud-score gates every charge; rejections are recorded.

**Route file.** `src/routes/qmaskcard.ts`

**Database tables.**

| Table | Notable columns |
|---|---|
| `QMaskCardMask` | `id`, `userId`, `pan`, `kind`, `status`, `limitCents`, `usedCents`, `expiresAt`, `meta` |
| `QMaskCardCharge` | `id`, `maskId`, `amountCents`, `currency`, `merchantHint`, `fraudScore`, `decision` (`approved\|declined\|review`), `createdAt` |

`kind` ∈ `{ single-use, subscription, capped, scoped }`.

**Public endpoints (read-only, no auth).**

| Method | Path |
|---|---|
| GET | `/api/qmaskcard/stats` |
| GET | `/api/qmaskcard/health` |

**Auth-gated endpoints (Bearer JWT).**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/qmaskcard/masks` | Issue a new mask |
| GET | `/api/qmaskcard/masks` | List caller's masks |
| POST | `/api/qmaskcard/masks/:id/revoke` | Revoke (mask becomes unusable, history preserved) |
| POST | `/api/qmaskcard/charges` | Attempt a charge; runs fraud-score |
| GET | `/api/qmaskcard/charges` | List charges for caller's masks |

**Admin endpoints.** None at present. (No `QMASKCARD_ADMIN_EMAILS` is wired.)

**Cross-product hooks.** On approved charge: `emitVeilNetXEntry({ module: 'qmaskcard', kind: 'settlement', amountCents, fromIdentifier: maskId, toIdentifier: merchantHint })`. On declined charge: VeilNetX entry with `kind: 'declined'` and `amountCents: 0`.

---

### 2.5 QGood

**Purpose.** Donation campaigns with admin-curated matching pools. Donations are anonymous on the public surface (donor identifiers HMAC-hashed before storage), and matching is computed at donation time against any active pool that fits the campaign's currency.

**Route file.** `src/routes/qgood.ts`

**Database tables.**

| Table | Notable columns |
|---|---|
| `QGoodCampaign` | `id`, `creatorUserId`, `title`, `goalCents`, `raisedCents`, `currency`, `status` (`pending\|approved\|active\|closed`), `approvedAt`, `meta` |
| `QGoodDonation` | `id`, `campaignId`, `donorHash`, `amountCents`, `currency`, `createdAt`, `meta` |
| `QGoodMatchingPool` | `id`, `funderUserId`, `poolCents`, `remainingCents`, `currency`, `ratio`, `status` (`active\|paused\|exhausted`), `meta` |
| `QGoodMatch` | `id`, `donationId`, `poolId`, `matchCents`, `createdAt` |

**Public endpoints (read-only, no auth).**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/qgood/campaigns` | Paginated, filter by status |
| GET | `/api/qgood/campaigns/:id` | Single campaign + recent donations |
| GET | `/api/qgood/matching-pools` | Active pools |
| GET | `/api/qgood/stats` | Global counters |
| GET | `/api/qgood/health` | Liveness |
| POST | `/api/qgood/campaigns/:id/donations` | **Anonymous donate** — no auth required |

**Auth-gated endpoints (Bearer JWT).**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/qgood/campaigns` | Create campaign (lands in `pending`) |

**Admin endpoints (`QGOOD_ADMIN_EMAILS`).**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/qgood/campaigns/:id/approve` | `pending → approved`, opens for donations |
| POST | `/api/qgood/matching-pools` | Fund a matching pool |
| POST | `/api/qgood/matching-pools/:id/pause` | Stops matching new donations |
| POST | `/api/qgood/matching-pools/:id/resume` | Resumes matching |

**Cross-product hooks.** On approved donation: `emitEcosystemEvent({ ledger: { module: 'qgood', kind: 'donation', amountCents }, reputation: { kind: 'qgood-donation', weight: 5 } })`. Matching pool draws emit a follow-up VeilNetX entry with `kind: 'match'`.

---

## 3. Cross-product event chain

All five modules talk through a single helper file: `src/lib/ecosystemEvents.ts`. Callers fire-and-forget — the helpers never throw and never block the response.

```
QPayNet  /deposit   → emitVeilNetXEntry({ module: 'qpaynet',  kind: 'deposit',    ... })
QPayNet  /withdraw  → emitEcosystemEvent({ ledger: { module: 'qpaynet', kind: 'withdrawal' },
                                            reputation: { kind: 'qpaynet-payout',  weight: +3 } })
QPayNet  /transfer  → emitVeilNetXEntry({ module: 'qpaynet',  kind: 'transfer',   ... })
Bureau   /upgrade   → emitEcosystemEvent({ ledger: { module: 'bureau',  kind: 'settlement' },
                                            reputation: { kind: 'bureau-cert',    weight: +10 } })
QGood    donation   → emitEcosystemEvent({ ledger: { module: 'qgood',   kind: 'donation' },
                                            reputation: { kind: 'qgood-donation', weight: +5 } })
QMaskCard charge    → emitVeilNetXEntry({ module: 'qmaskcard', kind: 'settlement', ... })
QChainGov vote      → emitZTideEvent({ kind: 'qchaingov-vote', sourceModule: 'qchaingov', weight: +1 })
QChainGov execute   → emitVeilNetXEntry({ module: 'qchaingov', kind: 'governance',  amountCents: 0 })
```

### Helpers

```ts
emitVeilNetXEntry({
  module: string,
  kind: string,
  fromIdentifier?: string,
  toIdentifier?: string,
  amountCents: number,
  currency?: string,
  meta?: Record<string, unknown>,
}): Promise<string | null>
```
Appends to `VeilNetXLedger` (hash-chained). Returns the new entry id, or `null` on failure. Fire-and-forget — never throws.

```ts
emitZTideEvent({
  userId: string,
  kind: ZTideEventKind,
  sourceModule: string,
  weightOverride?: number,
  meta?: Record<string, unknown>,
}): Promise<void>
```
Atomically inserts a `ZTideEvent`, upserts `ZTideScore`, and flips the rank tier if the new score crosses a threshold. Fire-and-forget — never throws.

```ts
emitEcosystemEvent({
  module: string,
  ledger: { kind, amountCents, ... },
  reputation?: { userId, kind, weight? },
}): Promise<void>
```
Convenience wrapper — invokes both `emitVeilNetXEntry` and `emitZTideEvent` if `reputation` is provided.

**All three helpers swallow errors and log via `console.error`.** Their `Promise` resolves successfully even on partial failure; the caller's response is never delayed or blocked.

---

## 4. Env vars

| Var | Module | Required | Default | Purpose |
|---|---|---|---|---|
| `VEILNETX_SALT` | VeilNetX | recommended | falls back to `SHARD_HMAC_SECRET` | HMAC salt for blinding participant identifiers |
| `SHARD_HMAC_SECRET` | VeilNetX (fallback) | recommended | dev-only built-in | Backup HMAC salt |
| `ZTIDE_ADMIN_EMAILS` | Z-Tide | yes (for admin writes) | empty | Comma-separated admin emails that can POST `/events` |
| `ZTIDE_SERVICE_KEY` | Z-Tide | optional | empty | Shared secret for service-to-service `/events` writes via `X-ZTide-Service-Key` |
| `QCHAINGOV_ADMIN_EMAILS` | QChainGov | yes (for lifecycle) | empty | Admin emails that can open/close/execute proposals |
| `QGOOD_ADMIN_EMAILS` | QGood | yes (for approval) | empty | Admin emails that can approve campaigns + fund pools |
| `STRIPE_SECRET_KEY` | QPayNet, Bureau | for live | empty (stubbed) | Live charge processing |
| `STRIPE_PUBLISHABLE_KEY` | QPayNet, Bureau | for live | empty | Frontend Stripe client init |
| `STRIPE_WEBHOOK_SECRET` | QPayNet, Bureau | for live | empty | Stripe webhook signature verification |
| `BUREAU_PAYMENT_PROVIDER` | Bureau | optional | `stub` | Set to `stripe` to enable real charges |
| `AEVION_PUBLIC_BASE_URL` | All | yes | none | Public base URL used in receipts, OG, webhooks |

Notes:
- `QMASKCARD_ADMIN_EMAILS` is **not** currently wired; QMaskCard has no admin surface in this revision.
- Missing `VEILNETX_SALT` and `SHARD_HMAC_SECRET` will start the server but log a warning and use a dev default — never deploy that way.

---

## 5. Smoke tests

All scripts live in `aevion-globus-backend/scripts/` and run against `http://localhost:4001` by default (override with `BASE_URL=...`).

| Script | Scope | Notes |
|---|---|---|
| `veilnetx-ledger-smoke.js` | VeilNetX | Chain head + write + verify integrity |
| `ztide-smoke.js` | Z-Tide | Leaderboard + `/me` (auth) + 401 path |
| `qchaingov-smoke.js` | QChainGov | Proposal create + vote-rejection edge paths |
| `qmaskcard-smoke.js` | QMaskCard | Issue + charge + revoke |
| `qgood-smoke.js` | QGood | 7-step user flow: create → approve → donate → match |
| `fintech-prod-smoke.js` | All 5 | **21 read-only checks — safe to run against prod** |
| `qpaynet-smoke.js` | QPayNet (adjacent) | Deposit/withdraw/transfer + VeilNetX correlation |

Run all backend smokes at once:

```bash
node scripts/all-smokes.js
```

The production read-only sweep (safe to run any time against `aevion-production-a70c.up.railway.app`):

```bash
BASE_URL=https://aevion-production-a70c.up.railway.app node scripts/fintech-prod-smoke.js
```

---

## 6. Operational scripts

One-shot CLI tools in `scripts/`. Each runs against `BASE_URL` env var (default `http://localhost:4001`).

| Script | What it does |
|---|---|
| `qchaingov-bootstrap.mjs` | Seeds 3 launch proposals via the live API. Idempotent — re-runs skip existing titles. |
| `qchaingov-execute-cron.mjs` | Auto-closes any `open` proposal past its `closesAt`, then runs the tally for all `closed` proposals. Designed for cron / scheduled task. |
| `stripe-verify.mjs` | Pre-flight check before flipping live mode. Reads `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, hits Stripe `/v1/balance`, validates webhook endpoint URL. Exits non-zero on any miss. |

---

## 7. Going live with Stripe (5-step checklist)

Reference: `.env.example` (project root) and `scripts/stripe-verify.mjs`.

1. **Get keys.** From the Stripe dashboard, copy the live secret key (`sk_live_...`), publishable key (`pk_live_...`), and webhook signing secret (`whsec_...`).
2. **Configure webhook.** In Stripe → Developers → Webhooks, add an endpoint pointing at `https://<your-base>/api/qpaynet/stripe/webhook` (and the equivalent Bureau path if used). Subscribe to `payment_intent.*` and `charge.*` events.
3. **Set env vars on Railway.** Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and `AEVION_PUBLIC_BASE_URL`. Trigger a redeploy.
4. **Run the verifier.** `node scripts/stripe-verify.mjs` — must exit 0 and print the live account name. Fix anything red before continuing.
5. **Flip the provider toggle.** Set `BUREAU_PAYMENT_PROVIDER=stripe` on Railway and redeploy. Run `fintech-prod-smoke.js` immediately after; verify a small test charge end-to-end before announcing.

Roll back at any point by unsetting `BUREAU_PAYMENT_PROVIDER` (falls back to `stub`).

---

## 8. Local dev quickstart

```bash
cd aevion-globus-backend && npm install && npm run dev   # backend on :4001
cd frontend && npm run dev                                # frontend on :3000 (second terminal)
node scripts/fintech-prod-smoke.js                        # sanity-check prod is healthy
```

---

## 9. Troubleshooting

**Chain head returns 0 / genesis after restart.**
The `VeilNetXLedger` table is created lazily on first write. Hit any endpoint that calls `emitVeilNetXEntry()` — e.g. seed a QGood donation — and the table appears with seq=1. No migration needed.

**Z-Tide `POST /events` returns 403.**
Either the caller's email is not in `ZTIDE_ADMIN_EMAILS`, or the request is missing/has a wrong `X-ZTide-Service-Key` header. Set one of these. Service-key writes are recommended for backend-to-backend calls; admin email is for human ops.

**QGood donation succeeds but no match appears.**
Three causes, in order of likelihood: (a) every matching pool with the campaign's currency is `exhausted` or `paused`; (b) currency mismatch between donation and all pools; (c) `pool.ratio * donation.amountCents < 1` — the computed match rounds to zero cents and is skipped. Check `/api/qgood/matching-pools` for live state.

**VeilNetX `integrity: broken` from `/chain/verify`.**
Rare — almost always indicates manual DB tampering or a migration that ran out of order. Snapshot the table, identify the first broken `seq`, decide whether to truncate-and-replay from a known-good seq or simply reset. The ledger has no external consumers that hold the chain hash, so resetting is safe in pre-prod. In prod, page the on-call.

---

## 10. Related docs

- `AEVION_COORDINATION.md` — zone ownership map. **Read before editing** any file referenced above.
- `src/lib/openapiFintechSpec.ts` — programmatic OpenAPI spec for the fintech surface.
- Live spec: `https://aevion-production-a70c.up.railway.app/api/openapi.json`
- `AEVION_API_README.md` — top-level backend API overview.
- `CLAUDE.md` — session context for the backend repo.
