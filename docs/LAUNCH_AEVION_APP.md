# AEVION launch checklist (`aevion.app` go-live)

**Status (2026-05-08):** code is 100% canonical-ready (`aevion.app` everywhere).
Backend stays on Railway URL until you optionally wire `api.aevion.app` CNAME.

Below is the exact sequence to flip the public switch. Each step is reversible
unless marked **destructive**.

---

## 1. Vercel domain wiring (5 min)

### If domain bought through Vercel Domains

1. Vercel → your project (`aevion`) → **Settings → Domains**
2. Click `Add` → enter `aevion.app` → **Add**
3. Vercel auto-creates the DNS records (it's the registrar for this case).
   No registrar action needed.
4. Wait 30–60s for `Issuing certificate…` → `Valid Configuration` (green check).
5. Add `www.aevion.app` the same way → choose `Redirect to aevion.app (308)`.

### If domain bought elsewhere (ps.kz, GoDaddy, etc.)

1. Vercel shows you the required DNS records:
   - Apex `aevion.app` → `A 76.76.21.21` (Vercel's anycast IP)
   - `www.aevion.app` → `CNAME cname.vercel-dns.com`
2. Add them at the registrar's DNS panel.
3. Wait 5–60 min for DNS propagation, then click `Verify` in Vercel.

---

## 2. Disable Vercel Authentication / SSO gate (1 min, **required**)

Without this, every page returns the Vercel login wall and Google can't crawl.

1. Vercel → project → **Settings → Deployment Protection**
2. Section **Vercel Authentication** → set to **Disabled**
3. Save.

Verify: open `https://aevion.app/` in an incognito window — you should see
the AEVION home page, not a login form.

---

## 3. Set production env vars on Vercel (3 min)

Vercel → project → **Settings → Environment Variables** (Production scope):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://aevion.app` |
| `BACKEND_PROXY_TARGET` | `https://aevion-production-a70c.up.railway.app` (or `https://api.aevion.app` after step 6) |
| `NEXT_PUBLIC_APP_VERSION` | `v1.0.0` (or your release tag) |
| `NEXT_PUBLIC_SENTRY_DSN` | (optional, for client-side error capture) |

Click `Save`, then `Deployments → … → Redeploy` on the latest production
build to pick them up.

---

## 4. Set production env vars on Railway (5 min)

Railway → API service → **Variables**:

| Key | Value |
|---|---|
| `PUBLIC_BACKEND_URL` | `https://aevion-production-a70c.up.railway.app` (replace if you wire `api.aevion.app`) |
| `FRONTEND_URL` | `https://aevion.app` |
| `QPAYNET_ADMIN_EMAILS` | comma list, lowercase: `you@example.com,ops@example.com` |
| `QPAYNET_ALERT_URL` | Slack/Discord webhook (drift + dead-letter alerts) |
| `QPAYNET_ENCRYPTION_KEY` | 32-byte base64 (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |
| `QPAYNET_AUDIT_REDACT` | `1` |
| `QPAYNET_PII_SALT` | another 32-byte base64 |
| `QPAYNET_SSE_MAX_PER_EMAIL` | `5` (default; raise if you have many ops dashboards) |
| `STRIPE_SECRET_KEY` | live key |
| `STRIPE_WEBHOOK_SECRET` | live webhook signing secret |
| `SMTP_*` | per `.env.example` |
| `SENTRY_DSN` | (optional) |

Allowlist envs (per module — set whichever are relevant):
`PLANET_ADMIN_EMAILS`, `BUREAU_ADMIN_EMAILS`, `AWARDS_ADMIN_EMAILS`,
`MODULES_ADMIN_EMAILS`, `PIPELINE_ADMIN_EMAILS`, `QSHIELD_ADMIN_EMAILS`,
`QRIGHT_ADMIN_EMAILS`.

Railway redeploys automatically when env changes.

---

## 5. Wire Railway cron jobs (5 min, **important for QPayNet**)

Railway → API service → **Settings → Cron** (or use a sidecar service):

| Schedule | Command | Why |
|---|---|---|
| `*/15 * * * *` | `node scripts/qpaynet-reconcile.mjs` | money-supply drift detection; non-zero exit triggers `QPAYNET_ALERT_URL` |
| `0 4 * * *` | `node scripts/qpaynet-idempotency-gc.mjs` | nightly GC of expired idempotency keys (24h TTL) |

Without the reconcile cron, drift is detected only when an admin opens the
dashboard — not acceptable for live money handling.

---

## 6. (Optional) Wire `api.aevion.app` for the backend (10 min)

Cleaner public URL, doesn't change anything functionally.

1. Railway → API service → **Settings → Networking → Custom Domain**
2. Add `api.aevion.app` → Railway shows the CNAME target
   (e.g., `<long-id>.railway.app`)
3. Vercel DNS (or registrar) → add CNAME: `api.aevion.app` → `<that target>`
4. Wait for SSL provisioning (~2 min).
5. On Railway env: change `PUBLIC_BACKEND_URL` to `https://api.aevion.app`
6. On Vercel env: change `BACKEND_PROXY_TARGET` to `https://api.aevion.app`
7. Redeploy both.

OpenAPI spec at `https://api.aevion.app/api/qpaynet/openapi.json` will now
show the cleaner server URL.

---

## 7. Smoke verification (10 min)

```bash
# Run from your laptop after step 5 redeploys
cd aevion-globus-backend

# Public health (anon)
curl -sS https://aevion-production-a70c.up.railway.app/health | jq

# QPayNet admin endpoints (need ADMIN_JWT — sign in to /qpaynet, copy from devtools)
ADMIN_JWT=eyJhbGc... \
BASE=https://aevion-production-a70c.up.railway.app \
node scripts/qpaynet-smoke.js
```

Expected: `44 passed, 0 failed`.

Frontend smoke:
```bash
cd ../frontend
PLAYWRIGHT_BASE_URL=https://aevion.app \
ADMIN_JWT=$ADMIN_JWT \
npx playwright test qpaynet-admin-smoke
```

Manual checks (incognito, 3 min):

- [ ] `https://aevion.app/` loads home (no SSO wall)
- [ ] `https://aevion.app/qpaynet` loads
- [ ] `https://aevion.app/qpaynet/admin` shows login prompt for anon, full dashboard for admin
- [ ] `https://aevion.app/sitemap.xml` returns XML with `aevion.app` URLs
- [ ] `https://aevion.app/robots.txt` allows everything except `/qpaynet/admin/*`
- [ ] OG image: paste `https://aevion.app/qpaynet` into Slack/Telegram → preview renders
- [ ] Backend `/api/qpaynet/openapi.json` returns 3.1 spec with correct server URL

---

## 8. Publish SDK (5 min)

```bash
cd packages/qpaynet-client
npm whoami                  # confirm npm auth
npm publish --access public # @aevion scope must exist; create org first if needed
```

After publish:
- `https://www.npmjs.com/package/@aevion/qpaynet-client` should show v1.0.2
- Test consume: `npm i @aevion/qpaynet-client@latest` in a scratch dir.

---

## 9. Search Console + analytics (10 min, can defer)

- Google Search Console → Add property `aevion.app` → verify via DNS TXT
- Submit `https://aevion.app/sitemap.xml`
- Bing Webmaster Tools (5 min): same flow
- (optional) Plausible/Umami/PostHog for traffic analytics

---

## Rollback plan

If `aevion.app` breaks:

1. Vercel → Deployments → previous green deployment → **Promote to Production**
2. If env vars are wrong: revert via Vercel UI (last 5 saves are kept)
3. Railway: `PUBLIC_BACKEND_URL` and `FRONTEND_URL` can be flipped back without redeploy (env-driven)

The Railway URL never changes — that's your stable fallback for backend.

---

## What's already done in code (as of HEAD `4f0aef9c`)

- All canonical URLs swapped to `aevion.app` (91 files, sitemap, OG, JSON-LD, SDK READMEs, email defaults, OpenAPI contact, i18n strings).
- QPayNet admin UI complete: 7 pages under `/qpaynet/admin/*` (reconcile, refund + bulk + CSV, freeze with search, webhook-deliveries, audit, payouts, kyc) + live SSE feed + sparklines + Sentry capture.
- QPayNet backend: 50+ endpoints incl. `/admin/{wallets,events,refund,refund/bulk,refunds,refunds.csv,audit,analytics,reconcile,webhook-deliveries}`. SSE rate-limit per email. HMAC merchant signing.
- SDK `@aevion/qpaynet-client@1.0.2` builds clean, 16.4kB tarball.
- Smoke: 44 sections (`scripts/qpaynet-smoke.js`).
- Playwright: `e2e/qpaynet-admin-smoke.spec.ts` covers all 8 admin routes.
- RUNBOOK: `docs/qpaynet/RUNBOOK.md` (8 sections, 30+ done items).

You should be live in production within 30–60 min of starting step 1.
