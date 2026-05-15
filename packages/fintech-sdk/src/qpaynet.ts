import type { FintechClient } from "./client";
import type {
  Wallet,
  WalletStatus,
  Transaction,
  TransactionKind,
  PaymentRequest,
  MerchantApiKey,
  MerchantChargeResult,
} from "./types";

/** Filter options for {@link QPayNetModule.listWallets}. */
export interface ListWalletsOpts {
  status?: WalletStatus;
  currency?: string;
}

/** Request body for {@link QPayNetModule.openWallet}. */
export interface OpenWalletBody {
  label: string;
  currency: string;
}

/** Request body for {@link QPayNetModule.transfer}. */
export interface TransferBody {
  fromWalletId: string;
  toWalletId: string;
  amountCents: number;
  /**
   * Idempotency key. Replays with the same paymentRef return the original
   * transaction without re-debiting the wallet.
   */
  paymentRef?: string;
  description?: string;
}

/** Request body for {@link QPayNetModule.deposit} (sandbox/dev stub). */
export interface DepositBody {
  walletId: string;
  amountCents: number;
  paymentRef?: string;
}

/** Filter options for {@link QPayNetModule.listTransactions}. */
export interface ListTransactionsOpts {
  walletId?: string;
  kind?: TransactionKind;
  /** ISO 8601 timestamp; only include transactions after this point. */
  since?: string;
  /** Max rows to return; backend caps at 200. */
  limit?: number;
}

/** Request body for {@link QPayNetModule.createPaymentRequest}. */
export interface CreatePaymentRequestBody {
  walletId: string;
  amountCents: number;
  memo?: string;
  /** ISO 8601 timestamp. Defaults to 24h from now on the server. */
  expiresAt?: string;
  /** Max number of public token resolutions before auto-expiring. */
  maxViews?: number;
}

/** Request body for {@link QPayNetModule.payPaymentRequest}. */
export interface PayPaymentRequestBody {
  fromWalletId: string;
}

/** Request body for {@link QPayNetModule.mintMerchantKey}. */
export interface MintMerchantKeyBody {
  walletId: string;
  label: string;
}

/** Response from {@link QPayNetModule.mintMerchantKey}. Secret returned ONCE. */
export interface MintMerchantKeyResponse extends MerchantApiKey {
  /** Full secret — shown only once at creation. Store immediately. */
  secret: string;
}

/** Request body for {@link QPayNetModule.merchantCharge}. */
export interface MerchantChargeBody {
  payerWalletId: string;
  amountCents: number;
  /**
   * Server-side idempotency key per merchant. Replay returns the original
   * transaction with `idempotent: true` and the original charge id.
   */
  paymentRef: string;
  description?: string;
}

/** Response shape from /api/qpaynet/stats. */
export interface QPayNetStatsResponse {
  totalWallets?: number;
  activeWallets?: number;
  totalTransactions?: number;
  /** Big-int cents; serialized as a string. */
  totalVolumeKzt?: string | number;
  totalDepositedKzt?: string | number;
  service?: string;
  [key: string]: unknown;
}

/**
 * QPayNet — wallets, transfers, payment requests, deposits and merchant
 * charges. Endpoints: `/api/qpaynet/*`.
 *
 * Most write endpoints require Bearer JWT. `merchantCharge` is the exception:
 * it authorizes via `X-Merchant-Key` header instead. Use
 * {@link QPayNetModule.merchantCharge} with the secret obtained from
 * {@link QPayNetModule.mintMerchantKey}.
 *
 * Idempotency:
 *  - `transfer` and `merchantCharge` accept `paymentRef` — replays return
 *    the original transaction (with `idempotent: true` on merchantCharge).
 *  - `payPaymentRequest` is idempotent on the token itself.
 */
export class QPayNetModule {
  constructor(private readonly client: FintechClient) {}

  // ── Health + stats ─────────────────────────────────────────────────────
  health(): Promise<{ status: string; service: string; timestamp: string }> {
    return this.client.request("GET", `/api/qpaynet/health`);
  }

  stats(): Promise<QPayNetStatsResponse> {
    return this.client.request("GET", `/api/qpaynet/stats`);
  }

  // ── Wallets ────────────────────────────────────────────────────────────
  /** List caller's wallets (Bearer required). */
  listWallets(opts: ListWalletsOpts = {}): Promise<{ wallets: Wallet[] }> {
    const qs = new URLSearchParams();
    if (opts.status) qs.set("status", opts.status);
    if (opts.currency) qs.set("currency", opts.currency);
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return this.client.request("GET", `/api/qpaynet/wallets${tail}`);
  }

  /** Open a new wallet (Bearer required, daily cap applies). */
  openWallet(body: OpenWalletBody): Promise<Wallet> {
    return this.client.request("POST", `/api/qpaynet/wallets`, body);
  }

  /** Public projection of a wallet — no balance or owner identity (no auth). */
  getPublicWallet(id: string): Promise<{ id: string; label: string; currency: string; isMerchant: boolean }> {
    return this.client.request(
      "GET",
      `/api/qpaynet/wallets/${encodeURIComponent(id)}/public`,
    );
  }

  // ── Money movement ─────────────────────────────────────────────────────
  /**
   * P2P transfer between wallets. Atomic debit+credit in a single SQL tx.
   * Idempotent on (fromWalletId, paymentRef).
   */
  transfer(body: TransferBody): Promise<Transaction> {
    return this.client.request("POST", `/api/qpaynet/transfer`, body);
  }

  /** Stub deposit (sandbox/dev). Production deposits go through /deposit/checkout. */
  deposit(body: DepositBody): Promise<Transaction> {
    return this.client.request("POST", `/api/qpaynet/deposit`, body);
  }

  /** List caller's transactions across all owned wallets. */
  listTransactions(opts: ListTransactionsOpts = {}): Promise<{ transactions: Transaction[] }> {
    const qs = new URLSearchParams();
    if (opts.walletId) qs.set("walletId", opts.walletId);
    if (opts.kind) qs.set("kind", opts.kind);
    if (opts.since) qs.set("since", opts.since);
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return this.client.request("GET", `/api/qpaynet/transactions${tail}`);
  }

  // ── Payment requests ───────────────────────────────────────────────────
  /** Create a one-shot payment request. Returns payerToken to share. */
  createPaymentRequest(body: CreatePaymentRequestBody): Promise<PaymentRequest> {
    return this.client.request("POST", `/api/qpaynet/requests`, body);
  }

  /** Public lookup by token (no auth). Bumps viewCount. */
  getPaymentRequest(token: string): Promise<PaymentRequest> {
    return this.client.request(
      "GET",
      `/api/qpaynet/requests/${encodeURIComponent(token)}`,
    );
  }

  /** Fulfil a payment request from caller's wallet (Bearer required). */
  payPaymentRequest(token: string, body: PayPaymentRequestBody): Promise<Transaction> {
    return this.client.request(
      "POST",
      `/api/qpaynet/requests/${encodeURIComponent(token)}/pay`,
      body,
    );
  }

  // ── Merchant rail ──────────────────────────────────────────────────────
  /**
   * Mint a new merchant API key. The full `secret` is returned ONCE in the
   * response — store it server-side immediately, you cannot fetch it later.
   */
  mintMerchantKey(body: MintMerchantKeyBody): Promise<MintMerchantKeyResponse> {
    return this.client.request("POST", `/api/qpaynet/merchant/keys`, body);
  }

  /** List existing merchant API keys (no secrets, only prefixes). */
  listMerchantKeys(): Promise<{ keys: MerchantApiKey[] }> {
    return this.client.request("GET", `/api/qpaynet/merchant/keys`);
  }

  /**
   * Server-side merchant charge against a payer wallet. Auth via merchant key
   * (X-Merchant-Key header), NOT Bearer JWT. Pass the secret from
   * {@link QPayNetModule.mintMerchantKey}. Idempotent on paymentRef.
   *
   * This method bypasses the client's Bearer token entirely and sends only
   * X-Merchant-Key.
   */
  async merchantCharge(merchantKeySecret: string, body: MerchantChargeBody): Promise<MerchantChargeResult> {
    const f = this.client.opts.fetch ?? fetch;
    const url = `${this.client.opts.baseUrl.replace(/\/+$/, "")}/api/qpaynet/merchant/charge`;
    const timeoutMs = this.client.opts.timeoutMs ?? 10_000;
    let signal: AbortSignal | undefined;
    if (typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === "function") {
      signal = (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout(timeoutMs);
    }
    const res = await f(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Merchant-Key": merchantKeySecret,
      },
      body: JSON.stringify(body),
      signal,
    });
    let json: unknown;
    try { json = await res.json(); } catch { json = {}; }
    if (!res.ok) {
      const payload = (json ?? {}) as Record<string, unknown>;
      throw {
        status: res.status,
        code: typeof payload.error === "string" ? payload.error : "merchant_charge_failed",
        message: typeof payload.message === "string" ? payload.message : undefined,
      };
    }
    return json as MerchantChargeResult;
  }
}
