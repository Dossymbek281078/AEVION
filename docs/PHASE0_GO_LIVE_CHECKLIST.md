# AEVION — Phase 0 Go-Live Checklist (DNS + SSO + smoke)

> **Created** 2026-06-20 · executes `docs/AEVION_MASTER_PLAN.md` § 4 Phase 0.
>
> This is the **single biggest blocker**: until P0-1 + P0-2 are done, every
> "shipped" module is invisible (Vercel returns 401 SSO gate to crawlers,
> partners, investors, customers).
>
> **Division of labour:** Claude prepared this. **You execute** the dashboard
> steps (they need your Vercel + DNS-registrar access). Each step has a
> verify command so we both know it landed.

---

## Known facts (from memory + repo)

- Vercel project that serves the monorepo: **`aevion/aevion`** (all
  `*.vercel.app` URLs currently SSO-gated → `401`).
- `aevion.io` is a **different** project (CRA + PostHog) — **not ours**, do
  not touch it.
- Target custom domain (pick one, used as the public origin below):
  **`aevion.app`** (placeholder — set to whatever you own at the registrar).
- Backend prod origin (Railway): `https://aevion-production-a70c.up.railway.app`.
- Env truth table already done: `docs/PROD_ENV_CHECKLIST.md` (P0-3 ✅).

---

## P0-2 — Remove SSO / Deployment Protection  ← **do this FIRST, it's instant**

Removing the gate makes the existing `*.vercel.app` deploy publicly
reachable **today**, before DNS even propagates. Fastest path to a live URL.

1. Vercel → project **`aevion`** → **Settings → Deployment Protection**.
2. **Vercel Authentication**: switch to **Disabled** (this is the SSO 401 gate).
3. If **Password Protection** is on → also Disable (or set to "Only Preview"
   if you want prod public but previews locked).
4. **Save**. Redeploy is **not** required — protection is edge-level.

**Verify (Claude can run this once you confirm):**
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://aevion.vercel.app/
# expect 200 (was 401). Try /pricing and /qright too.
```
> If still 401: the gate may be set at **team** level — Vercel → Team
> Settings → Deployment Protection → make sure it's not forcing SSO org-wide.

---

## P0-1 — Custom domain + DNS cutover

### A. Add the domain in Vercel
1. Vercel → project **`aevion`** → **Settings → Domains → Add**.
2. Enter **`aevion.app`** and **`www.aevion.app`**.
3. Vercel shows the DNS records to create. Two options:
   - **Apex (`aevion.app`)** → `A` record → `76.76.21.21` (Vercel's anycast IP
     — confirm the exact value Vercel shows you; it can change).
   - **`www`** → `CNAME` → `cname.vercel-dns.com`.
   - *(If your registrar supports it, point the apex via `ALIAS`/`ANAME` to
     `cname.vercel-dns.com` instead of the A record — cleaner.)*

### B. Create the records at your registrar
4. Log into the DNS registrar for `aevion.app`.
5. Add the `A` (apex) and `CNAME` (www) records from step 3.
6. Pick a redirect direction (Vercel → Domains → set primary):
   recommend **apex `aevion.app` as primary**, `www` → 308 redirect to apex.

### C. Wait + verify
7. Propagation: minutes to ~1h. Verify:
```bash
nslookup aevion.app          # resolves to Vercel IP
curl -sS -o /dev/null -w "%{http_code}\n" https://aevion.app/        # 200
curl -sS -o /dev/null -w "%{http_code}\n" https://aevion.app/qright  # 200
```
8. Vercel auto-provisions the TLS cert once DNS resolves — wait for the green
   "Valid Configuration" in Settings → Domains.

### D. Point the frontend/back-end origins at the real domain
9. Set `CORS_ALLOWED_ORIGINS` on Railway to include the new origin:
   `https://aevion.app,https://www.aevion.app` (see `PROD_ENV_CHECKLIST.md` §1).
10. If the frontend hardcodes an API base or canonical URL anywhere, set the
    public env (e.g. `NEXT_PUBLIC_SITE_URL=https://aevion.app`) and redeploy.

---

## P0-3a — Wire env validator into the Railway deploy pre-step

So a missing required secret fails the deploy instead of silently shipping an
unsafe default.

1. Railway → service `aevion-globus-backend` → **Settings → Deploy**.
2. Set the **pre-deploy / build** command to run the validator first:
   `node scripts/check-prod-env.js && <existing build/start>`
   (the script already exists per P0-3; it enforces the 🔴 REQUIRED tier).
3. Trigger a redeploy; confirm it boots green. If it fails, it will name the
   missing var — fill it from `docs/PROD_ENV_CHECKLIST.md` and redeploy.

---

## P0-4 — Point smoke scripts at the live prod URL

1. All `npm run smoke:*` scripts accept a `BASE` env (or `PROD_BASE`). After
   P0-2, run them against the public origin:
```bash
cd aevion-globus-backend
BASE=https://aevion.app npm run smoke:bank-prod      # expect 24/24 (or current)
BASE=https://aevion.app node scripts/all-smokes.js   # full sweep
```
2. The daily-smoke GitHub Actions cron should get the prod `BASE` as a repo
   secret so it runs against live, not localhost.

---

## Definition of done for Phase 0

- [ ] `curl https://aevion.vercel.app/` → **200** (SSO gone) — P0-2
- [ ] `curl https://aevion.app/` + `/qright` + `/pricing` → **200** — P0-1
- [ ] TLS cert "Valid" in Vercel Domains — P0-1
- [ ] `CORS_ALLOWED_ORIGINS` includes the live origin — P0-1
- [ ] Railway deploy runs `check-prod-env.js` and boots green — P0-3a
- [ ] `BASE=https://aevion.app` smoke sweep passes — P0-4

Once all six are checked, every prod-ready module in the launch-readiness
table is **publicly live**, and we move to per-module hardening + the
license-gated demo framing for Bank / QTrade / Payments / health modules.

---

## After Phase 0 — what Claude drives next (code side)

1. Tier 2/3 hardening: CyberChess + QBuild + смета + Multichat — smoke +
   Sentry + i18n parity (mirrors the planet/awards pattern).
2. License-gated framing pass: add "demo / non-custodial / not financial
   advice / not medical advice" banners to Bank, QTrade, Payments Rail,
   QPayNet, QMaskCard, HealthAI, QLife, QGood, PsyApp, QPersona before they
   face the public internet.
3. Verification sweep over the ~30 MVP modules with backends-on-main but no
   tracked hardening, to assign each a real prod-readiness stage.
