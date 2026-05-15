# Security Audit Part 2 — Systemic Secret Hardening (2026-05-08)

> Companion to [`SECURITY_AUDIT_2026-05-08.md`](SECURITY_AUDIT_2026-05-08.md).
> Documents the systemic sweep that came out of running the static regression
> test introduced in Part 1.
>
> **Code shipped in commit [`18a2ccb7`](https://github.com/Dossymbek281078/AEVION/commit/18a2ccb7)**
> — note: that commit's message ("docs(press): press release …") was a
> parallel-session piggyback. The 12 files starting with `qsignSecret.ts` and
> ending with `sharedSecretsHardening.test.ts` are the security sweep
> described below; the 3 `docs/press/*` files were added by another window.

---

## Findings — 6 routes, 11 occurrences

A regression test (`tests/sharedSecretsHardening.test.ts`) walks `src/routes/`
and fails CI on any `process.env.*_SECRET || "dev-..."` pattern. The first
run found 9 routes still carrying the same shape Part 1 fixed in `bureau.ts`
and `qsign.ts`:

| File | Pattern | Risk |
|---|---|---|
| `awards.ts` | `AUTH_JWT_SECRET \|\| "dev-auth-secret"` | Admin endpoints (qualify, disqualify, finalize season) — token forgery would let anyone close a season + mint medals. |
| `modules.ts` | same | Admin module-status flip. |
| `planetCompliance.ts` ×3 | `AUTH_JWT_SECRET` + 2× `QSIGN_SECRET \|\| "dev-qsign-secret"` | Quorum cert signing + vote-snapshot HMAC. Forge → fake compliance certificate. |
| `pipeline.ts` | `JWT_SECRET \|\| "dev-secret-change-me"` (wrong env name AND public default) | Admin pipeline endpoints. |
| `quantum-shield.ts` | same as pipeline | Admin shard inspection / reconstruction. |
| `bankTest.ts` ×3 | `*_WEBHOOK_SECRET \|\| "dev-*-webhook"` | Outbound webhook HMAC for bank diagnostics. |
| `cyberchess.ts` | `CYBERCHESS_WEBHOOK_SECRET \|\| "dev-chess-webhook"` | Inbound `/tournament-finalized` webhook — mint chess prizes. |
| `planetPayouts.ts` | `PLANET_WEBHOOK_SECRET \|\| "dev-planet-webhook"` | Inbound `/certify-webhook` — mint planet payouts. |
| `qrightRoyalties.ts` | `QRIGHT_WEBHOOK_SECRET \|\| "dev-qright-webhook"` | Inbound `/verify-webhook` — mint royalty payouts. |

**Net impact in production prior to fix:**
- All admin endpoints across awards/modules/pipeline/quantum-shield were
  effectively bypassable if anyone knew the OSS code (the public default is
  literally in the GitHub repo).
- Webhook endpoints accepted forged HMAC signatures.
- Planet vote snapshots could be forged → invalidating Awards' compliance
  trust model entirely.

---

## Fix shape

1. **New helper** `src/lib/qsignSecret.ts` exports `getQSignSecret()` and
   `requireProdSecret(envKey, devFallback)` — single fail-closed gate (≥32
   chars, no `dev-` prefix in production, throw clear message otherwise).
2. **All 11 sites** replaced with one of:
   - `jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] })` for JWT
     verification (also pins HS256 to block alg-confusion).
   - `requireProdSecret("FOO_SECRET", "dev-foo")` for HMAC keys.
3. **Webhook secret reads** moved from module-load eager constants to
   per-request lazy getters — a missing prod env now fails the specific
   route, not the whole boot.
4. **Static regression test** (`sharedSecretsHardening.test.ts`) walks all
   `.ts` files under `src/routes/` and fails if either the pattern or any
   of the 3 literal default strings reappears.

---

## Verification

```
$ npx vitest run tests/sharedSecretsHardening.test.ts \
                tests/qsignLegacyHardening.test.ts \
                tests/bureauSecurityHardening.test.ts \
                tests/webhookClassifier.test.ts
Test Files  4 passed (4)
     Tests  36 passed (36)
```

Plus prod-side smoke 20/20 green after Railway redeploy.

---

## Required Railway env (currently set)

- `AUTH_JWT_SECRET` — long random; **already set**.
- `QSIGN_SECRET` — long random; **set 2026-05-08** during Part 1.
- `QRIGHT_WEBHOOK_SECRET`, `CYBERCHESS_WEBHOOK_SECRET`, `PLANET_WEBHOOK_SECRET`
  — long random each. **Status: must be confirmed.** If any is unset, the
  corresponding route returns 500 (intended fail-closed); existing functional
  flows remain green. Action item below.

---

## Action items (post-merge)

- [ ] Verify `QRIGHT_WEBHOOK_SECRET`, `CYBERCHESS_WEBHOOK_SECRET`,
      `PLANET_WEBHOOK_SECRET` are set on Railway with ≥32-char random values.
      Without them, partner-webhook routes 500 — intended, but blocks
      `/bank/diagnostics` HMAC self-test.
- [ ] After all 4 secret envs are set, re-run `bank-prod-smoke.js` to confirm
      no degradation.
- [ ] Optional follow-up: rotate `AUTH_JWT_SECRET` quarterly (forces global
      logout via tokenVersion bump on AEVIONUser rows).
