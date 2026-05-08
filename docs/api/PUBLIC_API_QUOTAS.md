# AEVION Public API — Quotas & Pricing

> Source-of-truth for AEVION's public API tier matrix. Machine-readable mirror:
> [`GET /api/quotas`](https://aevion.app/api-backend/api/quotas).
>
> **Version:** 1.1.0 · **Published:** 2026-05-08 · **Owner:** `aevion-backend-modules`
>
> Public-facing pricing page: [`aevion.app/pricing/api-pricing`](https://aevion.app/pricing/api-pricing).
> Tier names + monthly quotas in this doc are kept in sync with that page.

---

## 1. Why this exists

AEVION's public API surface monetises Phase 4. Before the first paying B2B
customer, we need a **published, defensible, machine-readable** tier matrix
so that:

- Sales conversations cite concrete numbers (not "we'll figure it out").
- Partners can plan their integration cost up-front.
- The launch announcement (`docs/PHASE4_LAUNCH_ANNOUNCEMENT.md`) has
  an anchor URL for "see pricing".
- A future enforcement layer has a deterministic config source.

**This doc is the contract; code in `src/routes/apiQuotas.ts` is the
canonical machine-readable mirror.** They must stay in sync. PRs that
change one MUST change the other.

---

## 2. Tier matrix

| Tier | Price (USD/mo) | Monthly calls | Rate limit | SLA uptime | Support | Per-call discount | Keys | Best for |
|---|---:|---:|---:|---:|---|---:|---:|---|
| **Developer** | $0 | 10 000 | 100/min | — | community | — | 1 | Прототипы, SDK-тесты, hobby |
| **Build** | $49 | 100 000 | 500/min | 99.0% | email 48h | -15% | 5 | Запуск, MVP, single-product B2B |
| **Scale** | $249 | 1 000 000 | 2 000/min | 99.5% | email 24h + Slack | -30% | 10 | Production SaaS, marketplaces |
| **Enterprise** | custom | unlimited | unlimited | 99.9% | dedicated rep, 4h | -50%+ | unlimited | TikTok-class, governments, on-prem |

**Notes:**
- Developer tier requests above 100/min → HTTP 429 + `Retry-After`.
- Monthly calls — hard quota. Overage billed at per-endpoint rate-card with tier discount applied (see `aevion.app/pricing/api-pricing`).
- Enterprise quotas negotiated per-contract; contact `api@aevion.app`.

---

## 3. API key format

```
aev_test_<24bytes_base64url>     # sandbox keys (no billing, full surface)
aev_live_<24bytes_base64url>     # production keys (billed, tier-enforced)
```

**Header:** `X-Aevion-Api-Key: aev_live_xxx...`
**Storage:** `sha256(key)` only — raw key shown once at issuance.
**Issuance:** self-serve `POST /api/keys` (auth required). Free tier: 1 key.
Paid: up to 10 keys per account.

QPayNet merchant keys (`qpn_live_*`) are a **separate** per-merchant system
and are NOT subject to the tier matrix. They have their own per-merchant
rate-limits via `QPAYNET_RATE_TIERS` env override.

---

## 4. Endpoint surface (v1.0)

The following endpoints are **public API** (subject to tier limits).
Internal endpoints (auth, admin, dashboard) are NOT in the public surface.

| Method | Path | Cost units | Description |
|---|---|---:|---|
| GET | `/api/qright/objects` | 1 | List public IP registry entries |
| GET | `/api/bureau/cert/:id/embed` | 1 | Embed-ready cert viewer (HTML+JSON) |
| GET | `/api/bureau/notaries` | 1 | Catalog of notary partners |
| GET | `/api/bureau/trust-edges/cert/:id` | 1 | Trust Graph edges for a cert |
| POST | `/api/qsign/verify` | 2 | Verify ML-DSA-65 signature (CPU-heavy) |
| GET | `/api/awards/seasons/:id/results` | 1 | Awards season results + Merkle proofs |
| GET | `/api/planet/snapshots/:id` | 2 | Compliance snapshot with evidenceRoot |

**Cost units:** rate limit consumption per call. Default 1; CPU-heavy
endpoints (verify, snapshots with proof generation) count 2. Tier rate
limit is total cost units per minute, not raw request count.

---

## 5. Migration / rollout plan

### Phase A — design (this doc + machine-readable endpoint) ✅ 2026-05-08

- `docs/api/PUBLIC_API_QUOTAS.md` published.
- `GET /api/quotas` returns matrix.
- Onepager + launch announcement updated to link to this doc.

### Phase B — issuance (gated on first paying B2B customer)

- `POST /api/keys` — issue platform-level key, default tier `free`.
- `GET /api/keys` — list mine.
- `DELETE /api/keys/:id` — revoke.
- DB table: `aevion_api_keys (id, owner_id, name, key_hash, key_prefix, tier, scopes, revoked_at, created_at)`.
- Stripe subscription wires tier upgrades automatically.

### Phase C — enforcement

- `apiQuotaMiddleware(req, res, next)` checks `X-Aevion-Api-Key` header.
- Looks up tier, applies per-minute and daily caps from `apiQuotas.ts`.
- 429 response includes `X-Aevion-Tier`, `X-Aevion-Quota-Reset`.
- Backwards compatible: requests without API key continue under
  IP-based rate limit (the existing `awardsEmbedRateLimit` etc).

### Phase D — observability

- `/api/admin/quotas/usage` — admin-only, per-key consumption.
- Sentry alert: tier-overage spike.
- Daily report: top consumers, near-limit accounts → sales lead.

---

## 6. Decision log

**Why no usage-based pricing on Free?**
Friction kills discovery. Hard cap + 429 is cleaner than a surprise bill.

**Why $0.001 / $0.0005 overage?**
Anchored to AWS API Gateway ($0.0035 / $0.0011) at half/third price.
We're cheaper because we have lower COGS (single Postgres, no Lambda).

**Why per-minute, not per-second?**
Bursts are normal for content-platform indexing jobs. Per-second is
hostile UX; per-minute averages noise.

**Why only 7 endpoints in v1?**
These are all stable, idempotent, and already CDN-cacheable. Auth/admin/
write endpoints (POST /api/qright, POST /api/bureau/upgrade) stay
internal until the partner story is mature.

**Why separate from QPayNet merchant keys?**
QPayNet is a payments rail; its per-merchant model already works.
Mixing merchant identity with platform-API identity confuses billing.

---

## 7. Open questions

- **Authentication of free-tier requests:** today many endpoints are
  fully public (no auth). Do we require even free-tier users to register
  for a key? Pro: telemetry, anti-abuse. Con: friction. **Tentative: no
  key required for cached GETs (TTL ≥ 5 min); key required for everything
  else.**
- **Cache hits as cost units:** if a request is served from CDN cache,
  does it count? **Tentative: no.** This is what makes Free viable.
- **Webhooks:** do outbound webhooks from AEVION (e.g. payment events)
  count toward partner quota? **Tentative: no, they're a push channel.**
- **SLA enforcement:** at what point does an SLA breach trigger a credit?
  Industry standard is monthly availability < SLA threshold. **Tentative:
  apply Stripe credit equal to the % below threshold × monthly fee.**

These resolve when the first paying B2B customer signs (Phase B trigger).

---

## 8. Maintenance

- Bump `QUOTAS_VERSION` in `apiQuotas.ts` for every backwards-incompatible change.
- Old version remains queryable via `GET /api/quotas?v=0.x` (future).
- Major version bumps (2.0.0) require a 90-day notice on this doc.
