## Summary

QSign v2 **v1.1** — closes the entire post-GA backlog in one branch. 3 commits on top of v1.0 (PR #17 already merged), build green, **129 vitest specs green** (117 → 129 = 12 new Dilithium specs), OpenAPI bumped to **v2.1.0**.

This PR turns the Dilithium "preview slot" into a real post-quantum signature surface and adds two production-grade hardening hooks (Sentry + npm SDK publish path).

## What's in

### 1️⃣ Real ML-DSA-65 (FIPS 204 Dilithium-3) — opt-in via env (`f70e0ec`)
- Replaces SHA-512 preview fingerprint with **actual post-quantum signatures** when `QSIGN_DILITHIUM_V1_SEED` is set on the server.
- Backed by [`@noble/post-quantum`](https://www.npmjs.com/package/@noble/post-quantum) — pure-JS, MIT-licensed, audited implementation. ~5ms sign, ~3ms verify, ~3.3 KB signatures.
- ESM/CJS bridged via a tiny `dilithiumLoader.js` shim — neither tsc nor vitest's transformer touches the dynamic `import()`. `npm run build` post-step (`scripts/copy-cjs-shims.js`) copies the shim into `dist/`.
- Two modes coexist:
  | Mode | Trigger | kid | Field | Length |
  |------|---------|-----|-------|--------|
  | preview | env unset | `qsign-dilithium-mldsa65-preview-v1` | `digest` | 128 hex |
  | real    | env set   | `qsign-dilithium-mldsa65-v1`         | `signature` + `publicKey` | ~6618 hex |
- **Verify auto-detects mode by signature length**, so historical preview rows continue to verify after the operator turns on real ML-DSA. Forward-only: don't unset the env once real-mode rows exist.
- Surface updated: `/sign`, `/sign/batch`, `/verify` (stateless), `/verify/:id`, `/:id/public`, `/:id/pdf` — all return the new shape based on row content. `OpenAPI` v2.1.0.
- 12 new vitest specs: preview determinism, real round-trip, tampered detection, mode auto-detect, malformed seed rejection, real-mode non-determinism, keypair derivation.

### 2️⃣ SDK publish-ready (`6ef3313`)
- Both `@aevion/qsign-client` (2.0.0) and `@aevion/qsign-webhook-receiver` (1.0.0) now `npm publish`-ready:
  - `license: MIT`, `author: AEVION`
  - `publishConfig.access: public` (required for scoped `@aevion/*` on the public registry)
  - `prepublishOnly` script — fires `npm run build` so `index.js` + `index.d.ts` artifacts ship even though they're gitignored
  - `LICENSE` file + `.gitignore` per package
- Deploy doc gets §13 Publishing the SDKs — npm login + per-package publish + version bumps.

### 3️⃣ Sentry hook — opt-in via env (`561a96a`)
- Wraps every 5xx `errResp()` with `captureException` so prod incidents flow into Sentry with structured tags: `service: qsign-v2`, `requestId`, `errorCode`, `path`, `method`, `status`.
- Skip-if-no-DSN: when `SENTRY_DSN` is unset/empty the wrapper stays dormant — no init, no network IO, no perf cost.
- Tracing off by default (`tracesSampleRate=0`); tunable via `SENTRY_TRACES_SAMPLE_RATE`.
- Bootstraps before `app.listen` so startup failures are captured.
- 7 new vitest specs cover dormant + active states (idempotent init, undefined-value filtering, TRACES_SAMPLE_RATE override).

## New env vars

| Var | Required? | Effect |
|-----|-----------|--------|
| `QSIGN_DILITHIUM_V1_SEED` | optional | 64-hex seed activates real ML-DSA-65; otherwise preview mode |
| `SENTRY_DSN` | optional | activates error capture; otherwise dormant |
| `SENTRY_TRACES_SAMPLE_RATE` | optional | float 0–1, default 0 |

## Compat / risk

- Existing rows signed under preview mode still verify correctly after the env upgrade. The `/verify/:id` path detects mode by stored signature length.
- New rows signed with the env on are tagged with the real-mode kid; verifying them when the env is later unset returns `valid: false, mode: real` (config issue, not a tampered verdict).
- No DB schema changes. The existing `signatureDilithium` column holds either format.
- No breaking API changes. The `dilithium` block now has `mode: "preview" | "real"` and an additional `signature` + `publicKey` payload in real mode; all preview-mode consumers (`digest` field) continue to work.

## Verification

```bash
npm run verify              # backend tsc + frontend next build, exit 0
cd aevion-globus-backend && npm test    # 15 files / 129 specs green
```

After merge + Railway redeploy:
```bash
BASE=https://aevion-production-a70c.up.railway.app NO_REVOKE=1 npm run smoke:qsign-v2
# expect 20+ steps PASS; mode shows "preview" until QSIGN_DILITHIUM_V1_SEED is set on Railway.
```
