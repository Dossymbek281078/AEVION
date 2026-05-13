/**
 * @aevion/fintech-sdk — TypeScript client for the AEVION fintech ecosystem.
 *
 * Six modules under one client:
 *   QGood       — charity campaigns + donations + matching pools
 *   QMaskCard   — virtual payment masks + idempotent charges
 *   VeilNetX    — privacy-blinded settlement ledger (hash-chained)
 *   Z-Tide      — adaptive reputation / contribution layer
 *   QChainGov   — on-chain governance proposals + voting
 *   QPayNet     — wallets, P2P transfers, payment requests, merchant rail
 *
 * Plus stand-alone webhook signing utilities (HMAC-SHA256 + timestamp
 * replay protection + rolling secret rotation) that mirror AEVION's
 * server-side verifier exactly.
 *
 * Quick start:
 * ```ts
 * import { FintechClient } from "@aevion/fintech-sdk";
 *
 * const client = new FintechClient({
 *   baseUrl: "https://aevion-production-a70c.up.railway.app",
 * });
 *
 * // anonymous reads
 * const { campaigns } = await client.qgood.listCampaigns({ status: "active" });
 * const head = await client.veilnetxLedger.chainHead();
 *
 * // authed actions
 * const authed = client.withToken(jwt);
 * const wallets = await authed.qpaynet.listWallets();
 *
 * // merchant charges use a separate header, not Bearer
 * await client.qpaynet.merchantCharge(merchantSecret, {
 *   payerWalletId, amountCents: 5000, paymentRef: "order_42",
 * });
 * ```
 *
 * Receiving webhooks:
 * ```ts
 * import { verifyWebhook } from "@aevion/fintech-sdk";
 *
 * const result = await verifyWebhook({
 *   signature: req.headers["x-aevion-signature"] as string,
 *   timestamp: req.headers["x-aevion-timestamp"] as string,
 *   rawBody: rawBodyStr,
 *   secret: process.env.AEVION_WEBHOOK_SECRET!,
 *   previousSecrets: [process.env.AEVION_WEBHOOK_SECRET_OLD ?? ""].filter(Boolean),
 * });
 * if (!result.ok) return res.status(401).end();
 * ```
 */

// ── Modular client + per-module sub-clients ───────────────────────────────
export { FintechClient } from "./client";
export type { FintechClientOptions, HttpMethod } from "./client";

export { QGoodModule } from "./qgood";
export type {
  ListCampaignsOpts,
  CreateCampaignBody,
  DonateBody,
  DonateResponse,
  QGoodStatsResponse,
} from "./qgood";

export { QMaskCardModule } from "./qmaskcard";
export { VeilNetXLedgerModule } from "./veilnetxLedger";
export { ZTideModule } from "./ztide";
export { QChainGovModule } from "./qchaingov";

export { QPayNetModule } from "./qpaynet";
export type {
  ListWalletsOpts,
  OpenWalletBody,
  TransferBody,
  DepositBody,
  ListTransactionsOpts,
  CreatePaymentRequestBody,
  PayPaymentRequestBody,
  MintMerchantKeyBody,
  MintMerchantKeyResponse,
  MerchantChargeBody,
  QPayNetStatsResponse,
} from "./qpaynet";

// ── Shared response shapes ────────────────────────────────────────────────
export type {
  // QGood
  Campaign,
  CampaignStatus,
  Donation,
  MatchingPool,
  MatchingPoolStatus,
  // QMaskCard
  Mask,
  MaskKind,
  Charge,
  ChargeStatus,
  // VeilNetX
  LedgerEntry,
  // Z-Tide
  ZTideRank,
  ZTideRankId,
  ZTideEvent,
  ZTideLeaderboardRow,
  // QChainGov
  Proposal,
  ProposalStatus,
  ProposalVoteMode,
  Vote,
  ProposalTallyRow,
  // QPayNet
  Wallet,
  WalletStatus,
  WalletKycLevel,
  Transaction,
  TransactionKind,
  TransactionStatus,
  PaymentRequest,
  PaymentRequestStatus,
  MerchantApiKey,
  MerchantChargeResult,
  // Errors
  SDKError,
} from "./types";

// ── Webhook signing utilities ─────────────────────────────────────────────
export {
  verifyWebhook,
  signWebhookPayload,
  aevionWebhookHeaders,
} from "./webhookSigning";
export type {
  VerifyWebhookOpts,
  VerifyWebhookResult,
  SignWebhookOpts,
  SignWebhookResult,
} from "./webhookSigning";
