/**
 * @aevion/qsign-client — TypeScript client for QSign v2.
 *
 * Zero dependencies. Uses global fetch (Node 18+, browsers, Bun, Deno).
 * Mirrors the OpenAPI 3.0 spec served at /api/qsign/v2/openapi.json.
 *
 * Example:
 *
 *   import { QSignClient } from "@aevion/qsign-client";
 *   const qsign = new QSignClient({
 *     baseUrl: "https://aevion-production-a70c.up.railway.app/api/qsign/v2",
 *     token: process.env.AEVION_TOKEN,
 *   });
 *   const sig = await qsign.sign({ hello: "world" }, { idempotencyKey: "order-42" });
 *   const ok = await qsign.verify({
 *     payload: { hello: "world" },
 *     hmacKid: sig.hmac.kid,
 *     signatureHmac: sig.hmac.signature,
 *   });
 */

export type DilithiumPreview = {
  algo: "ML-DSA-65";
  kid: string;
  mode: "preview";
  digest: string;
  valid: boolean | null;
  note: string;
};

export type SignResponse = {
  id: string;
  algoVersion: string;
  canonicalization: string;
  payloadHash: string;
  payloadCanonical: string;
  hmac: { kid: string; algo: "HMAC-SHA256"; signature: string };
  ed25519: { kid: string; algo: "Ed25519"; signature: string; publicKey: string } | null;
  dilithium: DilithiumPreview | null;
  issuer: { userId: string | null; email: string | null };
  geo: {
    source: "ip" | "gps" | null;
    country: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  createdAt: string;
  verifyUrl: string;
  publicUrl: string;
  idempotent?: "fresh" | "replayed" | null;
  requestId?: string;
};

export type VerifyResponse = {
  valid: boolean;
  algoVersion: string;
  canonicalization: string;
  payloadHash: string;
  hmac: { kid: string; valid: boolean };
  ed25519: { kid: string | null; valid: boolean | null };
  dilithium: DilithiumPreview | null;
  stateless?: boolean;
};

export type DBVerifyResponse = VerifyResponse & {
  signatureId: string;
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string | null;
  issuer: { userId: string | null; email: string | null };
  geo: SignResponse["geo"];
};

export type Webhook = {
  id: string;
  url: string;
  events: ("sign" | "revoke")[];
  active: boolean;
  createdAt: string | null;
  lastFiredAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
};

export type WebhookDelivery = {
  id: string;
  event: "sign" | "revoke";
  attempt: 1 | 2 | 3;
  httpStatus: number | null;
  error: string | null;
  durationMs: number;
  succeeded: boolean;
  createdAt: string | null;
};

export type AuditEvent = {
  event: "sign" | "revoke";
  signatureId: string;
  revocationId: string | null;
  at: string | null;
  hmacKid: string;
  ed25519Kid: string | null;
  payloadHash: string;
  country: string | null;
  reason: string | null;
  causalSignatureId: string | null;
  revokerUserId: string | null;
  publicUrl: string;
};

export type HealthResponse = {
  service: "qsign-v2";
  status: "ok" | "degraded";
  algoVersion: string;
  canonicalization: string;
  uptimeSec: number;
  db: { ok: boolean; latencyMs: number | null; error: string | null };
  activeKeys: { hmac: string | null; ed25519: string | null; error?: string };
  counts?: {
    signatures: number;
    revoked: number;
    keys: number;
    activeWebhooks: number;
    deliveryAttempts: number;
  };
  memory?: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
};

export type SignOptions = {
  idempotencyKey?: string;
  gps?: { lat: number; lng: number };
};

export type ClientOptions = {
  baseUrl: string;
  token?: string;
  /** Optional fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout in ms (default 15s). */
  timeoutMs?: number;
};

export class QSignError extends Error {
  status: number;
  requestId: string | null;
  details: string | null;
  constructor(status: number, body: any) {
    super(body?.error || `qsign HTTP ${status}`);
    this.name = "QSignError";
    this.status = status;
    this.requestId = body?.requestId ?? null;
    this.details = body?.details ?? null;
  }
}

export class QSignClient {
  private baseUrl: string;
  private token?: string;
  private fetchImpl: typeof fetch;
  private timeoutMs: number;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    if (!this.fetchImpl) {
      throw new Error(
        "[qsign-client] no fetch available — pass `fetch` in ClientOptions on Node < 18",
      );
    }
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(extraHeaders ?? {}),
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      throw new QSignError(res.status, data);
    }
    return data as T;
  }

  // — health / metadata —

  health(): Promise<HealthResponse> {
    return this.req("GET", "/health");
  }

  openapi(): Promise<unknown> {
    return this.req("GET", "/openapi.json");
  }

  stats(): Promise<unknown> {
    return this.req("GET", "/stats");
  }

  recent(opts: { limit?: number } = {}): Promise<{
    items: any[];
    total: number;
    limit: number;
  }> {
    const q = opts.limit ? `?limit=${opts.limit}` : "";
    return this.req("GET", `/recent${q}`);
  }

  // — sign / verify —

  sign(payload: unknown, opts: SignOptions = {}): Promise<SignResponse> {
    const headers: Record<string, string> = {};
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    const body: Record<string, unknown> = { payload };
    if (opts.gps) body.gps = opts.gps;
    return this.req("POST", "/sign", body, headers);
  }

  signBatch(
    items: Array<unknown | { payload: unknown; gps?: { lat: number; lng: number } }>,
  ): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    hmacKid: string;
    ed25519Kid: string;
    algoVersion: string;
    results: Array<{ ok: boolean; id?: string; error?: string }>;
  }> {
    return this.req("POST", "/sign/batch", { items });
  }

  verify(input: {
    payload: unknown;
    hmacKid?: string;
    signatureHmac: string;
    ed25519Kid?: string;
    signatureEd25519?: string;
    signatureDilithium?: string;
  }): Promise<VerifyResponse> {
    return this.req("POST", "/verify", input);
  }

  verifyById(id: string): Promise<DBVerifyResponse> {
    return this.req("GET", `/verify/${encodeURIComponent(id)}`);
  }

  getPublic(id: string): Promise<unknown> {
    return this.req("GET", `/${encodeURIComponent(id)}/public`);
  }

  /** Returns the absolute URL to the PDF stamp; consumers can fetch or link to it. */
  pdfUrl(id: string, params: Record<string, string> = {}): string {
    const q = Object.keys(params).length
      ? "?" +
        Object.entries(params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&")
      : "";
    return `${this.baseUrl}/${encodeURIComponent(id)}/pdf${q}`;
  }

  // — revoke + audit —

  revoke(id: string, reason: string, causalSignatureId?: string): Promise<unknown> {
    return this.req("POST", `/revoke/${encodeURIComponent(id)}`, {
      reason,
      ...(causalSignatureId ? { causalSignatureId } : {}),
    });
  }

  listAudit(
    opts: { event?: "sign" | "revoke"; limit?: number; offset?: number } = {},
  ): Promise<{
    items: AuditEvent[];
    total: number;
    limit: number;
    offset: number;
    event: "sign" | "revoke" | null;
    asOf: string;
  }> {
    const params: string[] = [];
    if (opts.event) params.push(`event=${opts.event}`);
    if (opts.limit !== undefined) params.push(`limit=${opts.limit}`);
    if (opts.offset !== undefined) params.push(`offset=${opts.offset}`);
    const q = params.length ? `?${params.join("&")}` : "";
    return this.req("GET", `/audit${q}`);
  }

  // — keys —

  listKeys(): Promise<unknown> {
    return this.req("GET", "/keys");
  }

  getKey(kid: string): Promise<unknown> {
    return this.req("GET", `/keys/${encodeURIComponent(kid)}`);
  }

  rotateKey(input: {
    algo: "HMAC-SHA256" | "Ed25519";
    kid?: string;
    secretRef?: string;
    publicKey?: string;
    notes?: string;
  }): Promise<unknown> {
    return this.req("POST", "/keys/rotate", input);
  }

  // — webhooks —

  listWebhooks(): Promise<{ total: number; webhooks: Webhook[] }> {
    return this.req("GET", "/webhooks");
  }

  createWebhook(
    url: string,
    events: ("sign" | "revoke")[] = ["sign", "revoke"],
  ): Promise<Webhook & { secret: string; notice: string }> {
    return this.req("POST", "/webhooks", { url, events });
  }

  deleteWebhook(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.req("DELETE", `/webhooks/${encodeURIComponent(id)}`);
  }

  listDeliveries(
    webhookId: string,
    opts: { limit?: number } = {},
  ): Promise<{
    webhookId: string;
    total: number;
    limit: number;
    deliveries: WebhookDelivery[];
  }> {
    const q = opts.limit ? `?limit=${opts.limit}` : "";
    return this.req("GET", `/webhooks/${encodeURIComponent(webhookId)}/deliveries${q}`);
  }
}

export default QSignClient;
