# AEVION Bank — Production Launch Checklist

> Last updated: 2026-04-29 (late). Maintainer: Bank track. Target: smooth zero-surprise prod cutover.

This file lists every concrete step needed to flip AEVION Bank from "feature-complete dev branch" to "live on aevion.app". Skim this before any prod push.

**Branch state at this writing:** `bank-payment-layer` is **207 commits ahead** of `main` (PR #5 open). 43 indexable bank sub-routes (incl. `/bank/smoke`). Build green. All 18 wallet widgets are live, plus 14 standalone widget pages, plus the test-environment infrastructure shipped 2026-04-29 (smoke runner, StatusPill, TestModeBanner, PreflightBanner, QuickDemoControls, InvestorModeAutorun, idempotency keys).

## Test environment one-URL demo

For investor walk-throughs use a single URL:

> **`https://aevion.app/bank?investor=1`**

It registers a fresh demo user, redirects to `/bank/smoke?auto=1`, runs all 11 wired endpoints (auth → accounts → topup → transfer → sign → verify) live and lands on a printable signed receipt. The yellow `pre-license test mode` ribbon stays visible throughout for legal cover. See §1 below for the matching pre-merge gates.

---

## 0. Where things live

- **Frontend repo:** `Dossymbek281078/AEVION`
- **Active branch:** `bank-payment-layer` (PR #5 → `main`)
- **Worktree:** `C:\Users\user\aevion-core\frontend-bank`
- **Backend repo:** `aevion-globus-backend` (separate session)
- **Hosts:** Vercel (frontend), Railway (backend), Postgres (Railway / Neon)

Live: https://aevion.app · API: https://api.aevion.app · Status: https://status.aevion.app

---

## 1. Pre-merge gates (block if red)

- [ ] `npm run verify` from `aevion-core/` returns green (backend `tsc` + frontend `next build`)
- [ ] All 43+ bank routes render server-side without TypeScript errors
- [ ] No `console.error` or hydration warnings in dev console on `/bank`, `/bank/about`, `/bank/trust`, `/bank/security`, `/bank/help`, `/bank/budget`, `/bank/calendar`, `/bank/subscriptions`, `/bank/forecast`, `/bank/changelog`, `/bank/smoke`
- [ ] `/bank/smoke?auto=1` shows 11/11 green against staging in ≤7s
- [ ] `/bank?investor=1` provisions a demo + redirects to smoke + completes without errors
- [ ] `/api/qtrade/accounts`, `/transfers`, `/operations` resolve under 200ms p95 in staging
- [ ] `/api/qtrade/{topup,transfer}` enforce `Idempotency-Key` (replay test passes)
- [ ] QSign sign + verify round-trips on staging within 100ms p95
- [ ] No 401/403 from `/api/auth/me` while logged in
- [ ] `NEXT_PUBLIC_BANK_MODE=production` set so the yellow test-mode ribbon is hidden in prod (or kept visible if shipping pre-license)

## 2. Backend prep (separate session, but fronted track owns the audit)

- [ ] Prisma migrations applied to prod DB (`npx prisma migrate deploy` from CI)
- [ ] All env vars set in Railway:
  - `DATABASE_URL` (prod Postgres)
  - `JWT_SECRET` (rotated, ≥32 bytes random)
  - `QSIGN_KEYPAIR` (prod Ed25519)
  - `CORS_ORIGINS` includes `https://aevion.app`
- [ ] Railway service has health-check on `/api/health` returning `{ ok: true }`
- [ ] DB has nightly backup configured (Railway → Backups, retention 7 days minimum)
- [ ] Sentry DSN set, errors flowing in for at least one test event

## 3. Frontend Vercel config

- [ ] `NEXT_PUBLIC_SITE_URL=https://aevion.app` set in prod env
- [ ] `BACKEND_PROXY_TARGET=https://api.aevion.app` for `/api/*` rewrites
- [ ] Edge runtime quotas reviewed (OG images + manifest run on edge)
- [ ] Image domains allowlist: `aevion.app`, `cdn.aevion.app` (if any external assets)
- [ ] Analytics: `@vercel/analytics` active OR self-hosted Plausible script

## 4. Domain & DNS

- [ ] `aevion.app` apex points at Vercel
- [ ] `api.aevion.app` CNAME → Railway
- [ ] `status.aevion.app` set up (Better Uptime / Statuspage)
- [ ] HTTPS active everywhere; HSTS header enabled by Vercel default
- [ ] `manifest.webmanifest` served with correct MIME type
- [ ] `/sitemap.xml` reachable, `/robots.txt` reachable

## 5. Observability

- [ ] Sentry sourcemaps uploaded for the prod build
- [ ] Backend rate-limit (`/api/auth/login`, `/api/qtrade/transfers`) tested at 10 req/min per IP
- [ ] Audit log retention: signatures kept ≥200 entries client-side (verified via `MAX_KEEP` in `_lib/signatures.ts`)
- [ ] Status page lists: API, Frontend, DB, QSign as separate components

## 6. Smoke tests on prod (run after DNS flip)

Run these in order. Each should take <5 seconds.

| # | Action | Expected |
|---|---|---|
| 1 | Open `https://aevion.app` | landing renders |
| 2 | Open `/bank` while logged out | redirects to `/auth` |
| 3 | Sign up `smoke+<ts>@aevion.test` | account created, JWT in localStorage |
| 4 | `/bank` after sign-in | balance card renders, ops list empty |
| 5 | Top up 100 AEC | balance reflects 100, op appears, signed |
| 6 | Click on op → opens `/bank/receipt/<id>` | receipt renders with QSign verified badge |
| 7 | Open `/bank/about` in incognito | page loads, OG image lifts via `curl -I` |
| 8 | Open `/bank/help`, search "AEC" | matching answer expands |
| 9 | Open `/bank/glossary`, scroll to Trust group | 4 trust terms render |
| 10 | Run `curl https://aevion.app/sitemap.xml` | XML with 55+ urls |
| 11 | Test PWA install on mobile | install prompt appears |
| 12 | Open `/bank/budget`, set a category cap | cap saves, pace + projection populate |
| 13 | Open `/bank/calendar` | heat-mapped 30-day grid renders |
| 14 | Open `/bank/subscriptions` | scanner runs, flag counts surface |
| 15 | Open `/bank/forecast` | 3 scenario × 3 horizon controls work |
| 16 | Open `/bank/changelog` | timeline groups render with type tags |
| 17 | Cmd+K → "Jump to Budget Caps" while on `/bank/insights` | navigates to `/bank#bank-anchor-budget` |

## 7. Rollback plan

- Git revert PR #5 → push `main` → Vercel auto-rebuilds in ~2 min
- For DB migration rollback: keep the previous Prisma migration's `down` SQL ready in `_rollback/`
- For QSign keypair rotation: keep N-1 verifier keys for 7 days to avoid breaking existing signatures

## 8. Day-1 monitoring

- [ ] Sentry: zero errors in first 4 hours
- [ ] Backend p95 latency stable below 250ms
- [ ] No 5xx spikes on `/api/qtrade/*`
- [ ] Active session count growing (if marketing was triggered)
- [ ] Twitter / LinkedIn social previews lift OG images correctly (test with metatags.io)

## 9. Post-launch (week 1)

- [ ] Migrate mock-zone modules: QRight royalties → real `/api/qright/royalties`
- [ ] CyberChess winnings → real `/api/cyberchess/results`
- [ ] Planet bonuses → real `/api/planet/payouts`
- [ ] Lift hardcoded `aevion.app` from sample env to env var-driven
- [ ] Compose post-mortem doc if any incidents fired

---

## Estimated days at current pace

| stage | days | notes |
|---|---|---|
| Pre-merge gates | 0.5 | mostly automated; verify green now |
| Backend prep | 1 | separate session, can parallelise |
| Vercel + DNS | 0.5 | one-time |
| Observability | 0.5 | Sentry + status page |
| Smoke tests | 0.5 | once everything's flipped |
| **Total to working v1** | **~2 days** | with mocks for QRight/Chess/Planet |
| Post-launch mock removal | 1-2 weeks | depends on other module sessions |

---

## Open questions for the team

- KYC posture: are we declaring AEC explicitly as ecosystem credit (not regulated)? Add disclaimer to /bank footer if yes.
- Multi-region: is Vercel's edge enough or do we need a secondary backend region for KZ users?
- Analytics consent: do we need a cookie banner for EU traffic, or is the local-only data model enough to skip it?
- Press / launch coordination: who owns the announcement timing, and is the GTM track ready?
