# AEVION — Production Deployment Guide

## From Demo to Real Product: Step by Step

---

## 1. Buy Domain — aevion.app

### Option A: Namecheap (recommended)
1. Go to https://www.namecheap.com
2. Search for `aevion.app`
3. If available — buy ($12-15/year)
4. If taken — try: `aevion.io`, `aevion.co`, `getaevion.com`, `useaevion.com`

### Option B: Google Domains
1. Go to https://domains.google.com
2. Search and buy

### Option C: Cloudflare Registrar (cheapest)
1. Go to https://dash.cloudflare.com → Registrar
2. Search and buy (at cost, no markup)

---

## 2. Connect Domain to Vercel

1. Open https://vercel.com/aevion/aevion/settings/domains
2. Click "Add Domain"
3. Type `aevion.app`
4. Vercel will show DNS records to add
5. Go to your domain registrar → DNS settings
6. Add the records Vercel shows (usually A record or CNAME)
7. Wait 5-30 minutes for DNS propagation
8. Vercel auto-provisions SSL certificate

After this: `https://aevion.app` will show your site instead of `aevion.vercel.app`

---

## 3. Set Up Professional Email

### Option A: Zoho Mail (FREE for 1 domain, 5 users)
1. Go to https://www.zoho.com/mail/zohomail-pricing.html
2. Sign up for free plan
3. Add domain `aevion.app`
4. Add MX records to your DNS:
   - `mx.zoho.com` priority 10
   - `mx2.zoho.com` priority 20
5. Create mailbox: `info@aevion.app`, `dosymbek@aevion.app`

### Option B: Google Workspace ($6/user/month)
1. Go to https://workspace.google.com
2. Sign up with `aevion.app`
3. Add MX records as shown
4. Get: `info@aevion.app` with Gmail interface

### Option C: Cloudflare Email Routing (FREE forwarding)
1. In Cloudflare → Email → Email Routing
2. Add `info@aevion.app` → forwards to `yahiin1978@gmail.com`
3. Free, but can't send FROM info@aevion.app

---

## 4. Railway Backend — Already Working
- URL: `aevion-production-a70c.up.railway.app`
- PostgreSQL connected
- Health check: `/health` returns ok
- No changes needed — just update `BACKEND_PROXY_TARGET` in Vercel if domain changes

---

## 5. Environment Variables (Vercel)

Current vars (already set):
```
BACKEND_PROXY_TARGET=https://aevion-production-a70c.up.railway.app
API_INTERNAL_BASE_URL=https://aevion-production-a70c.up.railway.app
```

No changes needed for domain migration — Vercel handles routing.

---

## 6. What "Working" Means for Each Module

| Module | Current State | What's Needed for Production |
|--------|-------------|------------------------------|
| Auth | ✅ Working — register/login via Railway | Add OAuth (Google/GitHub) |
| QRight | ✅ Working — creates real records with SHA-256 | Add file upload, PDF export |
| QSign | ✅ Working — real HMAC signatures | Migrate to Ed25519 (planned) |
| Bureau | ✅ Working — signs and verifies | PDF certificate generation |
| Planet | ✅ Working — submissions, voting | More validators, Merkle tree |
| Awards | ✅ Working (with Planet backend) | Leaderboard live data |
| Bank | ⚠️ Demo data only | Real wallet backend needed |
| CyberChess | ✅ Working — local AI play | Stockfish WASM, multiplayer |
| QCoreAI | ⚠️ Needs ANTHROPIC_API_KEY | Set key in Railway env |

### Priority for "real" (not demo):
1. **Auth** — already real ✅
2. **QRight** — already real ✅ 
3. **QSign** — already real ✅
4. **Bureau** — already real ✅
5. **Planet** — already real ✅
6. **Bank** — needs real wallet backend (biggest gap)
7. **QCoreAI** — just add API key
8. **CyberChess** — works offline, multiplayer is future

---

## 7. Cost Summary

| Item | Monthly Cost | Annual Cost |
|------|-------------|-------------|
| Domain (aevion.app) | — | $12-15 |
| Vercel (Hobby → Pro) | $0-20 | $0-240 |
| Railway (current) | $5-20 | $60-240 |
| Zoho Mail (free plan) | $0 | $0 |
| **Total** | **$5-40/month** | **$72-495/year** |

---

## 8. Quick Commands

### Deploy after changes:
```powershell
cd C:\Users\user\aevion-core
git add -A
git commit -m "your message"
git push
```
Vercel auto-deploys in ~60 seconds.

### Check backend health:
```
https://aevion-production-a70c.up.railway.app/health
```

### Vercel dashboard:
```
https://vercel.com/aevion/aevion
```

### Railway dashboard:
```
https://railway.app/dashboard
```

---

*Last updated: March 30, 2026*
