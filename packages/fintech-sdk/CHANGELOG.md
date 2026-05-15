# Changelog

## 0.2.0 — 2026-05-13

### Added

- **QPayNet module** — 6th fintech surface, full wallets/transfers/requests/merchant API:
  - `qpaynet.health()`, `qpaynet.stats()`
  - `qpaynet.listWallets()` + `qpaynet.openWallet()` (Bearer)
  - `qpaynet.getPublicWallet()` (anonymous, returns label + currency only)
  - `qpaynet.transfer()` — atomic debit+credit, idempotent on `paymentRef`
  - `qpaynet.deposit()` — sandbox stub
  - `qpaynet.listTransactions()` with kind / walletId / since / limit filters
  - `qpaynet.createPaymentRequest()` / `getPaymentRequest()` / `payPaymentRequest()` — one-shot tokens
  - `qpaynet.mintMerchantKey()` (secret returned ONCE) / `listMerchantKeys()`
  - `qpaynet.merchantCharge(merchantKeySecret, body)` — uses `X-Merchant-Key` header, bypasses Bearer; returns `{ idempotent: true }` on paymentRef replay
- **Webhook signing utilities** — standalone module mirroring AEVION's server-side verifier:
  - `verifyWebhook()` — HMAC-SHA256 with 5-min timestamp tolerance (configurable), rolling secret rotation via `previousSecrets[]`, `sha256=`/`hmac-sha256:` prefix tolerance, constant-time compare
  - `signWebhookPayload()` — sender helper
  - `aevionWebhookHeaders()` — convenience: returns ready-to-fetch headers
  - Pure WebCrypto (Node 18+ / browsers / edge / Deno) — no native deps, no `@types/node` required
- **20+ new types**: `Wallet`, `Transaction`, `PaymentRequest`, `MerchantApiKey`, `MerchantChargeResult`, + status/kind enums

### Changed

- README rewritten to cover 6 modules + webhook signing.
- `index.ts` rewritten as a clean re-export surface (FintechClient + 6 module classes + 20+ types + 3 webhook helpers). The legacy monolithic `AevionFintechClient`/`createClient` exports have been removed in favour of the modular API.

### Breaking changes

- The legacy `AevionFintechClient` class and `createClient()` factory (along with the inline `QGoodClient`/`QMaskCardClient`/… subclasses defined in `index.ts`) are removed. Migrate to the modular `FintechClient`:

  ```ts
  // before (v0.1.x)
  import { createClient } from "@aevion/fintech-sdk";
  const c = createClient({ baseUrl, token });

  // after (v0.2.x)
  import { FintechClient } from "@aevion/fintech-sdk";
  const c = new FintechClient({ baseUrl }).withToken(token);
  ```

  Module shape is the same: `c.qgood`, `c.qmaskcard`, `c.veilnetxLedger`, `c.ztide`, `c.qchaingov` (renamed from `c.veilnetx`), plus `c.qpaynet` (new).

## 0.1.0 — 2026-05-12

Initial release: 5 modules (QGood, QMaskCard, VeilNetX, Z-Tide, QChainGov).
