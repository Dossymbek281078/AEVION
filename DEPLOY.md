# AEVION Payments Rail — Deployment

Single-step Vercel deploy of the entire rail (12 surfaces + 8 v1 API endpoints + receipts + audit).

## 1. Vercel project setup

1. Push the branch to GitHub (already done — `payments-rail` is on origin).
2. Go to [vercel.com/new](https://vercel.com/new) → Import `Dossymbek281078/AEVION`.
3. **Root Directory:** leave at repo root. The bundled `vercel.json` overrides build paths to `frontend/` automatically.
4. **Framework Preset:** Next.js (auto-detected via `vercel.json`).
5. **Environment Variables:** none required for first deploy — rail will run on the in-memory backend (cold-start resets, but everything works).
6. Deploy. First build takes ~3 min.

After deploy you should be able to hit:
- `https://<project>.vercel.app/payments` — lander
- `https://<project>.vercel.app/api/health` — should report `{"status":"ok","persistence":"memory"}`
- `https://<project>.vercel.app/api/openapi.json` — OpenAPI 3.1 spec

## 2. KV provisioning (production persistence)

In-memory backend resets on every cold start. To make refunds, audit log, and idempotency cache durable:

1. Vercel dashboard → your project → **Storage** tab → **Create Database** → **KV**.
2. Region: pick one matching your `vercel.json` regions (`iad1` or `fra1`).
3. **Connect to Project**. The two env vars are auto-injected:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. Vercel auto-redeploys. Verify on `/api/health`:
   ```
   { "persistence": "kv", ... }
   ```
   If it still says `memory`, the env vars didn't reach the runtime — re-check the Storage connection.

No code changes needed — `_persist.ts` detects the env at request time.

## 3. GitHub auto-deploy

Default Vercel behavior:
- Push to `main` → production deploy.
- Push to any other branch (incl. `payments-rail`) → preview deploy with its own URL.
- Open a PR → comment with the preview URL gets posted automatically.

CI gate (`.github/workflows/ci.yml`) runs `next build` on every push, so broken builds fail before they reach Vercel.

## 4. Custom domain

1. Vercel dashboard → Domains → add `aevion.app` (or subdomain like `pay.aevion.app`).
2. Vercel walks you through the CNAME / A record setup in your DNS provider.
3. After DNS propagates, the OG images, sitemap, and `getOrigin()` helper auto-resolve to the new domain — no code changes.

## 5. Post-deploy smoke test

Run from any machine that can reach the prod URL:

```bash
BASE="https://<your-project>.vercel.app"

# Health
curl -s "$BASE/api/health" | jq .

# OpenAPI
curl -sI "$BASE/api/openapi.json" | head -1

# Create a payment link (gets a sk_test_* key from /payments/api dashboard first)
curl -s -X POST "$BASE/api/payments/v1/links" \
  -H "Authorization: Bearer sk_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount":9900,"currency":"USD","title":"Smoke test"}' | jq .

# Audit log should now show one entry
curl -s "$BASE/api/payments/v1/audit?limit=5" \
  -H "Authorization: Bearer sk_test_YOUR_KEY" | jq .
```

## 6. Railway / other services

The rail is fully serverless on Vercel — no separate backend, no Railway service required. The historical `aevion-globus-backend` directory is part of the repo but unrelated to Payments Rail; its CI job stays green via the existing `.github/workflows/ci.yml` backend job.

## 7. Rate limits & caps

- 60 req/min per Bearer token (30 on `/webhooks/[id]/test`)
- Audit log retention: last 1000 entries (KV-backed when configured)
- Refunds list cap: 500 entries
- Webhook delivery timeout: 4 s, single attempt (retry queue planned for v1.4)

## 8. Known limits before v1.0 GA

- Webhook delivery best-effort, no exponential-backoff retry queue
- Email receipts (Resend) not wired
- PDF receipts not implemented (HTML printable only)
- SDK packages not published to npm/PyPI
- Disputes/chargebacks endpoint missing

See `frontend/src/app/payments/page.tsx` roadmap section for the live status of each item.
