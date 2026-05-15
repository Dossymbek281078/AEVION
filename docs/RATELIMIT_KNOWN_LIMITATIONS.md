# Rate Limiter — Known Limitations (2026-05-09)

> Filed during QCoreAI `/chat` Tier 3 hardening. Not a bug — a real
> consequence of using in-memory state across multiple Railway replicas.

---

## What's correct

`lib/rateLimit.ts` is a simple in-memory fixed-window limiter. From a single
process, it works exactly as configured: `max` requests per `windowMs`, then
HTTP 429.

Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`,
and `Retry-After` are emitted correctly per response.

## What's NOT correct under load

**State is per-process.** Railway can run multiple replicas of the backend
(hot deploy, horizontal scaling, even just transient duplication during a
rolling restart). Each replica has its own `GLOBAL_BUCKETS` Map.

**Effective limit ≈ `max × replica_count`.** A 30/min limiter on 2 replicas
allows ~60/min in practice (assuming roughly even load-balancer round-robin).

### How we noticed

Hammer test against `/api/qcoreai/chat` (`max: 30`, `windowMs: 60_000`):

```
  5: HTTP 200  remaining=25
 10: HTTP 200  remaining=20
 15: HTTP 200  remaining=15
 20: HTTP 200  remaining=10        ← bucket A counting down
 25: HTTP 200  remaining=28        ← bucket B (new replica), 2 hits
 30: HTTP 200  remaining=23
 35: HTTP 200  remaining=18
SUMMARY: 35 pass, 0 limited
```

remaining flipping from 10 to 28 mid-test = the load balancer routed
requests to a different replica with a fresh in-memory bucket.

## Affected limiters (all `lib/rateLimit.ts` consumers)

```
src/routes/auth.ts          loginIpRateLimit, passwordResetRateLimit, emailVerifyRateLimit
src/routes/awards.ts        awardsEmbedRateLimit
src/routes/build.ts         globalLimiter, messageLimiter
src/routes/build/ai.ts      aiRateLimiter
src/routes/bureau.ts        bureauEmbedRateLimit
src/routes/qcoreai.ts       chatLimiter, sharedLimiter, refineLimiter,
                            multiAgentLimiter, guidanceLimiter, evalRunLimiter,
                            batchLimiter
src/routes/qpaynet.ts       moneyLimiter, csvLimiter, publicLimiter
src/routes/quantum-shield.ts  rateLimiter (custom)
```

All are subject to the multi-replica multiplier. None of them are correctly
"global" right now.

## Risk profile

- **Low** for read-only public endpoints (badge.svg, transparency, leaderboard) — extra capacity is fine, abuse just costs us bandwidth.
- **Medium** for `/qcoreai/chat`, `/build/ai/*` — multiplied limit means LLM bills can grow `N×` what we configured.
- **Medium** for `/auth/login` — brute-force surface is `N×` larger than intended.
- **Low** for `/qpaynet/transfer` etc. that have additional per-user / per-wallet checks downstream.

## Options

1. **Accept and document** (current): set `max` values aggressive enough that even `max × N` is acceptable. E.g. `chat`: 30/min × 2 replicas = 60/min, still well below the AI bill we'd worry about. Add this doc so the next reader knows.
2. **Redis-backed limiter** (proper fix): rewrite `lib/rateLimit.ts` to use `INCR` + `EXPIRE` on Redis. One Redis call per request. Coordinated across replicas. Adds a Redis dependency.
3. **Pin to single replica** for routes that must have hard global limits — Railway flag, not currently set. Defeats horizontal scaling.
4. **Express middleware swap** — `express-rate-limit` already supports a Redis store via `rate-limit-redis`. Drop-in replacement.

## Recommended order

- Now: document (this file). No code change.
- When we add Redis to the stack for any reason (sessions, queues): switch the rate limiter to Redis-backed in the same PR.
- Until then: keep `max` values comfortable for `2 × replicas` worst-case and don't claim hard limits to partners.

## What to NOT do

- Don't disable rate limiting just because it's imperfect. In-memory still
  catches:
  - Buggy clients hammering one replica in a tight loop (most common case).
  - Bot floods that sit on one TCP connection / one keep-alive session.
- Don't switch to per-IP-only limits without IPs being trustworthy. We
  already check `x-forwarded-for[0]` which can be spoofed by a malicious
  client; combine with auth-token-based keying for sensitive endpoints
  (already done in `qpaynet`).
