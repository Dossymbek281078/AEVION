# AEV public /mint — R1 boundary finding (2026-05-09 → CLOSED 2026-05-10)

> ✅ **CLOSED** in commit [`9c85c69e`](https://github.com/Dossymbek281078/AEVION/commit/9c85c69e):
> auth gate added on `/mint` and `/sync` in production, smoke pivoted to
> register-first then run AEV layer authenticated. Frontend update unneeded —
> the public mining UI was never wired to the prod path.
>
> Verification on prod (uptime 75s after redeploy):
> - Anonymous `/mint` with valid amount → `HTTP 401 {error:"auth_required_in_prod", reason:"AEC mint requires Bearer auth on production (AEC↔fiat boundary R1)."}`
> - Authenticated `/mint` → `HTTP 200` with wallet.userId tied to the JWT subject.
> - `bank-prod-smoke.js` → still 24/24 PASS after pivot.
>
> Original finding writeup below for context.

---

## Original finding (2026-05-09)

> Discovered during qtrade/aev Tier 3 audit.

---

## What's wrong

`POST /api/aev/wallet/:deviceId/mint` is **public**: any client with any
device id can mint arbitrary AEC amounts. Auth is *optional* (the bearer
just gets associated with the wallet on first claim).

```ts
aevRouter.post("/wallet/:deviceId/mint", writeLimiter, async (req, res) => {
  const deviceId = sanitizeDeviceId(req.params.deviceId);
  const amount = clampAmount(req.body?.amount);  // any positive finite
  // ... bearer is optional: w.userId ??= bearerUserId
  w.balance += amount;  // server trusts client-supplied amount
  // ...
});
```

`POST /api/aev/wallet/:deviceId/sync` has the same trust hole — it merges
client-reported `lifetimeMined`, `globalSupplyMined`, `balance` with
`Math.max(existing, body)` so a client can lie upward.

## Why it violates the boundary

`docs/bank/AEC_FIAT_BOUNDARY.md` § R1 ("AEC is platform-minted only") was
written **after** these endpoints existed. The endpoints are vestigial from
the QTrade-style "device mining MVP" where the client computed mining
score and the server merely persisted it.

Per R1, the only legitimate AEC mint paths are:
- `internalMintForDevice()` (used by Bureau reward claim) — server-authoritative.
- (Future) server-side compute scoring — server-authoritative.

The public `POST /mint` and `POST /sync` lifetime-merge are NOT legitimate.

## Why it's not fixed today

`scripts/bank-prod-smoke.js` step 02 calls `POST /mint` directly without
auth. Just removing or auth-gating the endpoint would break daily-smoke
24/24 → red dashboard / Sentry alerts / unable to detect real regressions.

The fix is a 3-step coordinated change:

1. **Smoke pivot:** make smoke authenticate first (step 10 already does
   register), then use the bearer for /mint. Or pivot smoke to call
   `internalMintForDevice` via a test-only admin endpoint.
2. **Code change:** require auth on `/mint` and `/sync`; in production
   require a `role=admin` claim or a test-only header gated by env.
3. **Frontend update:** the QTrade-mining UI (if any) must use the new
   server-authoritative flow.

Step 1 alone is ~30 lines of smoke change. Step 2 is small. Step 3 may not
even exist (the public mining UI might never have shipped past stub).

## Risk assessment

- **Today, prod:** anyone can curl `POST /mint amount=1000000` and walk
  away with 1M AEC for that device. AEC has no fiat redemption (R2), so
  the immediate damage is bounded — they can spend it on platform-internal
  things (CyberChess prizes, etc).
- **Tomorrow, when AEC gets a real economy:** this becomes a real exploit.
  Anyone can mint to corner the market. Must be fixed before AEC has
  external value or platform spend with cap.

## Recommended next step

When someone next touches `aev.ts`:
1. Plan and ship the coordinated 3-step change above.
2. Drop in a static regression test that asserts `/mint` and `/sync`
   require auth in production (env-conditional 401).
3. Update `bank-prod-smoke.js` to authenticate before mint.

Until then: leave it. Documented here so it isn't re-discovered as new.

## Related

- `docs/bank/AEC_FIAT_BOUNDARY.md` — R1-R4 rules.
- `aevion-globus-backend/src/routes/aev.ts:197` — the offending endpoint.
- `aevion-globus-backend/src/routes/bureau.ts` — uses `internalMintForDevice`,
  the correct server-side mint authority.
- `aevion-globus-backend/scripts/bank-prod-smoke.js:01-08` — AEV smoke
  steps that need updating.
