/**
 * @aevion/qpaynet-client — TypeScript client for AEVION QPayNet.
 *
 * Embedded payment infrastructure (KZT) with HMAC-signed webhooks, idempotent
 * transfers, merchant API keys, payment links, in-app wallets.
 *
 * Wraps the public HTTP API documented at /api/qpaynet/openapi.json. Admin
 * endpoints are intentionally NOT exposed here — they're internal-ops only.
 *
 * @example User-token flow (an end-user managing their own wallet):
 * ```ts
 * import { QPayNetClient } from "@aevion/qpaynet-client";
 *
 * const client = new QPayNetClient({
 *   baseUrl: "https://aevion-production-a70c.up.railway.app",
 *   token: process.env.AEVION_JWT,
 * });
 *
 * const wallet = await client.wallets.create({ name: "Main" });
 * await client.deposit({ walletId: wallet.id, amount: 5000 });
 * const tx = await client.transfer({
 *   fromWalletId: wallet.id,
 *   toWalletId: "...",
 *   amount: 1000,
 * }, { idempotencyKey: "transfer-2026-05-06-001" });
 * ```
 *
 * @example Merchant-key flow (charging customer wallets):
 * ```ts
 * const merchant = new QPayNetClient({
 *   baseUrl: "...",
 *   merchantKey: "qpn_live_xxx",
 * });
 * await merchant.merchant.charge({
 *   customerWalletId: "...",
 *   amount: 1500,
 *   description: "Order #ORD-123",
 * });
 * ```
 *
 * @example Webhook verification (in your handler):
 * ```ts
 * import { verifyWebhook } from "@aevion/qpaynet-client";
 *
 * app.post("/webhooks/aevion", express.raw({ type: "application/json" }), (req, res) => {
 *   const ok = verifyWebhook({
 *     secret: process.env.AEVION_WEBHOOK_SECRET!,
 *     timestamp: req.headers["x-aevion-timestamp"] as string,
 *     signature: req.headers["x-aevion-signature"] as string,
 *     rawBody: req.body, // Buffer
 *   });
 *   if (!ok) return res.status(401).send("invalid signature");
 *
 *   const eventId = req.headers["x-aevion-event-id"] as string;
 *   // Dedupe on event-id (we may retry up to 5 times with same id):
 *   if (await alreadyProcessed(eventId)) return res.json({ received: true });
 *
 *   const payload = JSON.parse(req.body.toString());
 *   // ...handle...
 *   res.json({ received: true });
 * });
 * ```
 */

/* ═══════════════════════════════════════════════════════════════════════
   Public types — mirror the server contract from /openapi.json.
   ═══════════════════════════════════════════════════════════════════════ */

export type WalletStatus = "active" | "frozen" | "closed";
export type TxType =
  | "deposit"
  | "withdraw"
  | "transfer_in"
  | "transfer_out"
  | "merchant_charge"
  | "refund";
export type Scope = "charge" | "read" | "refund";

export interface Wallet {
  id: string;
  name: string;
  currency: string;
  balance: number;
  status: WalletStatus;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: TxType;
  amount: number;
  fee: number;
  currency: string;
  description: string | null;
  status?: string;
  ref_tx_id?: string | null;
  created_at: string;
}

export interface PaymentRequest {
  id: string;
  token: string;
  payUrl: string;
  amount: number;
  currency: string;
  notifyUrl?: string;
  notifySecret?: string;
}

export interface MerchantKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: Scope[];
  /** When true, every charge must include `X-Aevion-Timestamp` + `X-Aevion-Signature` headers. */
  requireSignature?: boolean;
  /** Raw key — only present in the `create` response. Save it; it won't be shown again. */
  key?: string;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string;
  /** Returned only on create. */
  secret?: string;
}

export interface DepositResult {
  txId: string;
  amount: number;
  newBalance: number;
}

export interface WithdrawResult {
  txId: string;
  amount: number;
  fee: number;
  newBalance: number;
}

export interface TransferResult {
  txOutId: string;
  txInId: string;
  amount: number;
  fee: number;
  newBalance: number;
}

export interface ChargeResult {
  ok: true;
  txId: string;
  amount: number;
  fee: number;
}

export interface CheckoutSession {
  id: string;
  url: string;
  status: "open" | "paid" | "expired";
  /** Stripe session ID when STRIPE_SECRET_KEY is configured server-side. */
  stripeSessionId?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Client configuration + error types
   ═══════════════════════════════════════════════════════════════════════ */

export interface QPayNetClientOptions {
  /** Backend root, e.g. `https://aevion-production-a70c.up.railway.app`. No trailing slash. */
  baseUrl: string;
  /** End-user JWT (Bearer). For wallet management, transfers, payment requests, etc. */
  token?: string;
  /** Merchant API key (`qpn_live_…`). For `/merchant/charge`. */
  merchantKey?: string;
  /**
   * If `true`, charge requests are signed with HMAC-SHA256 over `{timestamp}.{body}`
   * using the merchant key as secret. Required if your key was created with
   * `requireSignature: true`. Replay-protected via 5-minute timestamp window.
   */
  signRequests?: boolean;
  /** Per-request timeout (ms). Default 10000. */
  timeoutMs?: number;
  /** Auto-retry transient errors (5xx, 429) with exponential backoff. Default 3. */
  maxRetries?: number;
  /** Override fetch (for tests, custom proxies). Default = global fetch. */
  fetch?: typeof fetch;
  /** Custom user-agent. Default `@aevion/qpaynet-client/1.0.0`. */
  userAgent?: string;
}

export interface RequestOptions {
  /** Per-call idempotency key (for money paths). Same key + body → cached response. */
  idempotencyKey?: string;
  /** Per-call timeout override (ms). */
  timeoutMs?: number;
  /** Abort signal (cancel in-flight). */
  signal?: AbortSignal;
}

/**
 * Stable error class with machine-readable `code` matching the server's
 * `error` field. See OpenAPI `x-error-codes` for the registry.
 */
export class QPayNetError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly field?: string;
  public readonly details: Record<string, unknown>;

  constructor(opts: {
    code: string;
    status: number;
    message?: string;
    field?: string;
    details?: Record<string, unknown>;
  }) {
    super(opts.message ?? `${opts.code} (HTTP ${opts.status})`);
    this.name = "QPayNetError";
    this.code = opts.code;
    this.status = opts.status;
    this.field = opts.field;
    this.details = opts.details ?? {};
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Webhook verification helper (no client instance needed)
   ═══════════════════════════════════════════════════════════════════════ */

export interface VerifyWebhookOptions {
  secret: string;
  timestamp: string;
  signature: string;
  /** Either the raw bytes (preferred) or the exact string body. */
  rawBody: Uint8Array | ArrayBuffer | string;
  /** Reject if timestamp drift > N seconds. Default 300 (5 minutes). */
  toleranceSeconds?: number;
}

/**
 * Verify an inbound webhook from QPayNet. Returns Promise<boolean> — async
 * because Web Crypto is async.
 *
 * Performs:
 *   1. Timestamp drift check (default 5 min) — replay protection.
 *   2. Constant-time HMAC-SHA256 comparison.
 *
 * Isomorphic: works in modern Node (18+) and browsers via global SubtleCrypto.
 * Always pass the EXACT raw body bytes — JSON re-stringify won't byte-match.
 */
export async function verifyWebhook(opts: VerifyWebhookOptions): Promise<boolean> {
  const tolerance = opts.toleranceSeconds ?? 300;
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) return false;

  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) {
    throw new Error(
      "@aevion/qpaynet-client: Web Crypto SubtleCrypto unavailable. Use Node 18+ or a modern browser.",
    );
  }
  const enc = new TextEncoder();
  const bodyBytes = typeof opts.rawBody === "string"
    ? enc.encode(opts.rawBody)
    : (opts.rawBody instanceof Uint8Array ? opts.rawBody : new Uint8Array(opts.rawBody as ArrayBufferLike));
  const signed = enc.encode(`${opts.timestamp}.`);
  const message = new Uint8Array(signed.length + bodyBytes.length);
  message.set(signed, 0);
  message.set(bodyBytes, signed.length);

  const key = await subtle.importKey(
    "raw",
    new Uint8Array(enc.encode(opts.secret)).buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await subtle.sign("HMAC", key, new Uint8Array(message).buffer);
  const expected = `sha256=${bytesToHex(new Uint8Array(sigBuf))}`;
  return constantTimeEqualHex(opts.signature, expected);
}

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) {
    const h = b[i].toString(16);
    s += h.length === 1 ? "0" + h : h;
  }
  return s;
}

/**
 * Constant-time string comparison. Only meaningful if both strings are equal
 * length; differing length we bail early (which leaks length, but length
 * alone is not exploitable here — both sides are public-format strings).
 */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* ═══════════════════════════════════════════════════════════════════════
   Main client
   ═══════════════════════════════════════════════════════════════════════ */

export class QPayNetClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly merchantKey?: string;
  private readonly signRequests: boolean;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  /** Wallets sub-API. Use `client.wallets.create(...)`, etc. */
  public readonly wallets: WalletsApi;
  /** Merchant sub-API. Use `client.merchant.charge(...)`, etc. */
  public readonly merchant: MerchantApi;
  /** Payment requests sub-API. */
  public readonly requests: PaymentRequestsApi;
  /** Webhook subscriptions sub-API. */
  public readonly webhooks: WebhooksApi;

  constructor(opts: QPayNetClientOptions) {
    if (!opts.baseUrl) throw new Error("baseUrl required");
    if (!opts.token && !opts.merchantKey) {
      throw new Error("either `token` (user JWT) or `merchantKey` is required");
    }
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token;
    this.merchantKey = opts.merchantKey;
    this.signRequests = opts.signRequests ?? false;
    this.timeoutMs = opts.timeoutMs ?? 10000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.userAgent = opts.userAgent ?? "@aevion/qpaynet-client/1.0.0";

    this.wallets = new WalletsApi(this);
    this.merchant = new MerchantApi(this);
    this.requests = new PaymentRequestsApi(this);
    this.webhooks = new WebhooksApi(this);
  }

  /* ── Money endpoints (top-level for ergonomics) ──────────────────────── */

  /** Top up a wallet (sandbox/test path; for real cards use `wallets.depositCheckout`). */
  async deposit(
    body: { walletId: string; amount: number; description?: string },
    options: RequestOptions = {},
  ): Promise<DepositResult> {
    return this.request("POST", "/api/qpaynet/deposit", body, options);
  }

  /** Withdraw from a wallet (0.1% fee). */
  async withdraw(
    body: { walletId: string; amount: number; description?: string },
    options: RequestOptions = {},
  ): Promise<WithdrawResult> {
    return this.request("POST", "/api/qpaynet/withdraw", body, options);
  }

  /** P2P transfer (0.1% fee, atomic, KYC-aware above threshold). */
  async transfer(
    body: { fromWalletId: string; toWalletId: string; amount: number; description?: string },
    options: RequestOptions = {},
  ): Promise<TransferResult> {
    return this.request("POST", "/api/qpaynet/transfer", body, options);
  }

  /** List my transactions (auth-bound). */
  async listTransactions(walletId?: string): Promise<Transaction[]> {
    const path = walletId
      ? `/api/qpaynet/transactions?walletId=${encodeURIComponent(walletId)}`
      : "/api/qpaynet/transactions";
    const r = await this.request<{ transactions: Transaction[] }>("GET", path);
    return r.transactions ?? [];
  }

  /** CSV export (rate-limited 5/min/user). Returns the raw text. */
  async exportTransactionsCsv(walletId?: string): Promise<string> {
    const path = walletId
      ? `/api/qpaynet/transactions.csv?walletId=${encodeURIComponent(walletId)}`
      : "/api/qpaynet/transactions.csv";
    return this.requestText("GET", path);
  }

  /** Public ecosystem stats (no auth). */
  async stats(): Promise<{ activeWallets: number; totalTransactions: number; [k: string]: unknown }> {
    return this.request("GET", "/api/qpaynet/stats", undefined, { skipAuth: true });
  }

  /** Service health (no auth). Includes pool stats and stuck delivery count. */
  async health(): Promise<{
    status: "ok" | "degraded" | "error";
    service: string;
    wallets: number;
    pool: { total: number; idle: number; waiting: number } | null;
    encryption: "enabled" | "disabled";
    stuckWebhookDeliveries?: number;
  }> {
    return this.request("GET", "/api/qpaynet/health", undefined, { skipAuth: true });
  }

  /* ── Internal request plumbing ───────────────────────────────────────── */

  /** @internal */
  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions & { skipAuth?: boolean; useMerchantKey?: boolean } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "User-Agent": this.userAgent,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (!options.skipAuth) {
      if (options.useMerchantKey) {
        if (!this.merchantKey) throw new Error("merchantKey not configured");
        headers["X-API-Key"] = this.merchantKey;
      } else if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      } else if (this.merchantKey) {
        headers["X-API-Key"] = this.merchantKey;
      }
    }
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    // HMAC signing for merchant-key flows where the server requires it.
    // Uses Web Crypto so we stay isomorphic. Skipped when no merchantKey
    // attached (the route wouldn't accept it anyway).
    const bodyStr = body !== undefined ? JSON.stringify(body) : "";
    if (this.signRequests && options.useMerchantKey && this.merchantKey) {
      const ts = Math.floor(Date.now() / 1000).toString();
      const signed = `${ts}.${bodyStr}`;
      const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
      if (!subtle) throw new Error("@aevion/qpaynet-client: SubtleCrypto unavailable; cannot sign");
      const enc = new TextEncoder();
      const key = await subtle.importKey(
        "raw",
        new Uint8Array(enc.encode(this.merchantKey)).buffer,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sigBuf = await subtle.sign("HMAC", key, new Uint8Array(enc.encode(signed)).buffer);
      headers["X-Aevion-Timestamp"] = ts;
      headers["X-Aevion-Signature"] = `sha256=${bytesToHex(new Uint8Array(sigBuf))}`;
    }

    let lastErr: unknown;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        // If caller supplied a signal, abort our internal one too.
        if (options.signal) {
          if (options.signal.aborted) ctrl.abort();
          else options.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
        }
        const resp = await this.fetchImpl(url, {
          method,
          headers,
          body: body !== undefined ? bodyStr : undefined,
          signal: ctrl.signal,
        });
        clearTimeout(t);

        if (resp.status >= 500 || resp.status === 429) {
          if (attempt < this.maxRetries) {
            await sleep(backoffDelay(attempt));
            continue;
          }
        }
        const text = await resp.text();
        let payload: unknown = null;
        if (text) {
          try { payload = JSON.parse(text); } catch { payload = text; }
        }
        if (!resp.ok) {
          const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
          throw new QPayNetError({
            code: typeof p.error === "string" ? p.error : `http_${resp.status}`,
            status: resp.status,
            message: typeof p.error === "string" ? `${p.error} (HTTP ${resp.status})` : undefined,
            field: typeof p.field === "string" ? p.field : undefined,
            details: p,
          });
        }
        return payload as T;
      } catch (err) {
        lastErr = err;
        // Network errors retry-eligible if we still have attempts.
        if (err instanceof QPayNetError) throw err;
        if (attempt < this.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  /** @internal — for endpoints returning text/csv. */
  async requestText(method: string, path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { "User-Agent": this.userAgent };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const resp = await this.fetchImpl(url, { method, headers, signal: ctrl.signal });
      if (!resp.ok) {
        throw new QPayNetError({ code: `http_${resp.status}`, status: resp.status });
      }
      return await resp.text();
    } finally {
      clearTimeout(t);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-APIs
   ═══════════════════════════════════════════════════════════════════════ */

class WalletsApi {
  constructor(private readonly client: QPayNetClient) {}

  async create(body: { name?: string; currency?: string; metadata?: Record<string, unknown> } = {}): Promise<Wallet> {
    return this.client.request("POST", "/api/qpaynet/wallets", body);
  }

  async list(): Promise<Wallet[]> {
    const r = await this.client.request<{ wallets: Wallet[] }>("GET", "/api/qpaynet/wallets");
    return r.wallets ?? [];
  }

  async get(id: string): Promise<Wallet> {
    return this.client.request("GET", `/api/qpaynet/wallets/${encodeURIComponent(id)}`);
  }

  /** Public lookup — no auth, no balance. Returns `{ active, name, currency }`. */
  async lookup(id: string): Promise<{ id: string; name: string; currency: string; active: boolean }> {
    return this.client.request(
      "GET",
      `/api/qpaynet/wallets/${encodeURIComponent(id)}/public`,
      undefined,
      { skipAuth: true },
    );
  }

  async update(id: string, body: { name?: string; metadata?: Record<string, unknown> | null }): Promise<Wallet> {
    return this.client.request("PATCH", `/api/qpaynet/wallets/${encodeURIComponent(id)}`, body);
  }

  /**
   * Terminal closure. Requires zero balance + no pending payouts. Cannot be
   * undone via public API (admin-only unfreeze does not apply).
   */
  async close(id: string): Promise<{ ok: true; walletId: string; status: "closed" }> {
    return this.client.request("POST", `/api/qpaynet/wallets/${encodeURIComponent(id)}/close`, {});
  }

  /**
   * Create a Stripe Checkout Session for real-card top-up. Returns a hosted
   * URL the user redirects to. Falls back to a stub URL if Stripe isn't
   * configured server-side (still works for dev/staging UI flows).
   */
  async depositCheckout(body: { walletId: string; amount: number }): Promise<CheckoutSession> {
    return this.client.request("POST", "/api/qpaynet/deposit/checkout", body);
  }
}

class MerchantApi {
  constructor(private readonly client: QPayNetClient) {}

  async createKey(body: {
    walletId: string;
    name?: string;
    scopes?: Scope[] | string;
    /** When true, charges with this key must be HMAC-signed. Pair with `signRequests: true` on the client. */
    requireSignature?: boolean;
  }): Promise<MerchantKey> {
    const scopes = Array.isArray(body.scopes) ? body.scopes.join(",") : body.scopes;
    return this.client.request("POST", "/api/qpaynet/merchant/keys", { ...body, scopes });
  }

  async listKeys(): Promise<MerchantKey[]> {
    const r = await this.client.request<{ keys: MerchantKey[] }>("GET", "/api/qpaynet/merchant/keys");
    return r.keys ?? [];
  }

  async revokeKey(id: string): Promise<void> {
    await this.client.request("DELETE", `/api/qpaynet/merchant/keys/${encodeURIComponent(id)}`);
  }

  /**
   * Charge a customer wallet via the merchant API key flow. Requires the
   * `merchantKey` field on the client constructor (auth via `X-API-Key`,
   * not the user Bearer token). Key must have `charge` scope.
   */
  async charge(
    body: { customerWalletId: string; amount: number; description?: string },
    options: RequestOptions = {},
  ): Promise<ChargeResult> {
    return this.client.request("POST", "/api/qpaynet/merchant/charge", body, {
      ...options,
      useMerchantKey: true,
    });
  }
}

class PaymentRequestsApi {
  constructor(private readonly client: QPayNetClient) {}

  async create(body: {
    toWalletId: string;
    amount: number;
    description: string;
    note?: string;
    expiresAt?: string;
    notifyUrl?: string;
  }): Promise<PaymentRequest> {
    return this.client.request("POST", "/api/qpaynet/requests", body);
  }

  async list(): Promise<PaymentRequest[]> {
    const r = await this.client.request<{ requests: PaymentRequest[] }>("GET", "/api/qpaynet/requests");
    return r.requests ?? [];
  }

  /** Public (no auth) — view a request by token. */
  async getPublic(token: string): Promise<{
    id: string; token: string; amount: number; currency: string;
    description: string; status: string; expiresAt: string | null; paidAt: string | null;
  }> {
    return this.client.request(
      "GET",
      `/api/qpaynet/requests/${encodeURIComponent(token)}`,
      undefined,
      { skipAuth: true },
    );
  }

  /** Pay an open request with one of your wallets (auth-bound). */
  async pay(
    token: string,
    body: { fromWalletId: string },
    options: RequestOptions = {},
  ): Promise<{ txOutId: string; txInId: string; amount: number; fee: number; newBalance: number }> {
    return this.client.request(
      "POST",
      `/api/qpaynet/requests/${encodeURIComponent(token)}/pay`,
      body,
      options,
    );
  }

  async cancel(id: string): Promise<void> {
    await this.client.request("DELETE", `/api/qpaynet/requests/${encodeURIComponent(id)}`);
  }
}

class WebhooksApi {
  constructor(private readonly client: QPayNetClient) {}

  async subscribe(body: { url: string; events?: string }): Promise<WebhookSubscription> {
    return this.client.request("POST", "/api/qpaynet/webhook-subs", body);
  }

  async list(): Promise<WebhookSubscription[]> {
    const r = await this.client.request<{ subscriptions: WebhookSubscription[] }>(
      "GET",
      "/api/qpaynet/webhook-subs",
    );
    return r.subscriptions ?? [];
  }

  async unsubscribe(id: string): Promise<void> {
    await this.client.request("DELETE", `/api/qpaynet/webhook-subs/${encodeURIComponent(id)}`);
  }

  /**
   * Smoke-test your webhook endpoint. We deliver a synthetic
   * `payment_request.paid` payload signed with the secret you supply, and
   * return the actual delivery result + payload. Use this when wiring up
   * your handler — confirms HMAC verification, reachability, and timeouts.
   */
  async test(body: { url: string; secret: string }): Promise<{
    ok: boolean;
    deliveryStatus: number;
    deliveryError?: string;
    payload: Record<string, unknown>;
    signature: string;
    timestamp: number;
  }> {
    return this.client.request("POST", "/api/qpaynet/webhooks/test", body);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Internal helpers
   ═══════════════════════════════════════════════════════════════════════ */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Exponential backoff with jitter: 100ms, 200ms, 400ms, … capped at 2s. */
function backoffDelay(attempt: number): number {
  const base = Math.min(2000, 100 * Math.pow(2, attempt));
  return base + Math.random() * (base * 0.25);
}
