/**
 * @aevion/qshield-client — TypeScript client for AEVION Quantum Shield.
 *
 * Zero dependencies. Uses global fetch (Node 18+, browsers, Bun, Deno).
 * Mirrors the OpenAPI 3.0 spec served at /api/quantum-shield/openapi.json.
 *
 * Example:
 *
 *   import { QShieldClient } from "@aevion/qshield-client";
 *   const qs = new QShieldClient({
 *     baseUrl: "https://aevion-production-a70c.up.railway.app/api/quantum-shield",
 *     token: process.env.AEVION_TOKEN,
 *   });
 *   const created = await qs.create({
 *     objectTitle: "My masterpiece",
 *     payload: { hello: "world" },
 *     distribution: "distributed_v2",
 *   });
 *   // SAVE created.shards[0] to disk — server forgets it after this response.
 *   const verdict = await qs.reconstruct(created.id, [created.shards[0], created.shards[1]], {
 *     idempotencyKey: "verify-attempt-001",
 *   });
 *   console.log(verdict.valid); // true
 */

export type DistributionPolicy = "legacy_all_local" | "distributed_v2";

export type AuthenticatedShard = {
  index: number;
  sssShare: string;
  hmac: string;
  hmacKeyVersion: number;
  location?: string;
  createdAt?: string;
  lastVerified?: string;
};

export type ShieldRecord = {
  id: string;
  objectId: string | null;
  objectTitle: string;
  algorithm: string;
  threshold: number;
  totalShards: number;
  shards: AuthenticatedShard[];
  signature: string;
  publicKey: string;
  hmacKeyVersion: number;
  status: "active" | "revoked";
  legacy: boolean;
  ownerUserId: string | null;
  distribution: DistributionPolicy;
  witnessCid: string | null;
  createdAt: string;
};

export type PublicProjection = {
  id: string;
  objectId: string | null;
  objectTitle: string;
  algorithm: string;
  threshold: number;
  totalShards: number;
  publicKey: string | null;
  signature: string | null;
  status: string;
  legacy: boolean;
  hmacKeyVersion: number;
  verifiedCount: number;
  lastVerifiedAt: string | null;
  distribution: DistributionPolicy;
  witnessCid: string | null;
  witnessUrl: string | null;
  createdAt: string;
  verifyUrl: string;
};

export type ReconstructResult =
  | {
      valid: true;
      reconstructed: true;
      shieldId: string;
      verifiedAt: string;
      idempotent?: "replayed";
    }
  | {
      valid: false;
      reconstructed: false;
      reason: string;
    };

export type WitnessShard = {
  shieldId: string;
  shard: AuthenticatedShard;
  cid: string;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  event: "create" | "delete" | "reconstruct" | "revoke" | string;
  actorUserId: string | null;
  actorIp: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type HealthResponse = {
  status: "ok" | "error";
  service: "quantum-shield";
  algorithm: string;
  threshold: number;
  totalShards: number;
  hmacKeyVersion: number;
  totalRecords: number;
  activeRecords: number;
  legacyRecords: number;
  distributedRecords: number;
  shieldRecords: number;
  timestamp: string;
};

export type CreateOpts = {
  objectId?: string | null;
  objectTitle?: string | null;
  payload?: unknown;
  threshold?: number;
  totalShards?: number;
  distribution?: DistributionPolicy;
};

export type ListOpts = {
  limit?: number;
  offset?: number;
  mine?: boolean;
};

export type ListResponse = {
  records: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  total: number;
  limit: number;
  offset: number;
  mine: boolean;
};

export class QShieldError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `QShield API error ${status}`);
    this.name = "QShieldError";
    this.status = status;
    this.body = body;
  }
}

export interface QShieldClientOptions {
  /**
   * Base URL of the API. Default `/api/quantum-shield` for in-cluster calls.
   * Use a fully qualified URL when calling from outside the backend.
   */
  baseUrl?: string;
  /** JWT to send as Bearer for authenticated routes. */
  token?: string;
  /** Custom fetch implementation (defaults to globalThis.fetch). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms (uses AbortController). 0 disables. */
  timeoutMs?: number;
}

export class QShieldClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: QShieldClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/quantum-shield").replace(/\/+$/, "");
    this.token = options.token;
    this.fetchImpl =
      options.fetch ??
      (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : (() => {
            throw new Error("global fetch not available — pass options.fetch");
          })());
    this.timeoutMs = options.timeoutMs ?? 0;
  }

  private async req<T>(
    method: string,
    path: string,
    {
      body,
      headers,
      auth,
    }: { body?: unknown; headers?: Record<string, string>; auth?: boolean } = {},
  ): Promise<T> {
    const reqHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(headers ?? {}),
    };
    if (body !== undefined) reqHeaders["Content-Type"] = "application/json";
    if (auth !== false && this.token) {
      reqHeaders.Authorization = `Bearer ${this.token}`;
    }

    const controller = this.timeoutMs > 0 ? new AbortController() : null;
    const timer =
      controller && this.timeoutMs > 0
        ? setTimeout(() => controller.abort(), this.timeoutMs)
        : null;

    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: reqHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        /* allow empty body */
      }
      if (!res.ok) {
        throw new QShieldError(
          res.status,
          data,
          `${method} ${path} failed: HTTP ${res.status}`,
        );
      }
      return data as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** GET /health */
  health(): Promise<HealthResponse> {
    return this.req<HealthResponse>("GET", "/health", { auth: false });
  }

  /** GET /openapi.json */
  openapi(): Promise<unknown> {
    return this.req<unknown>("GET", "/openapi.json", { auth: false });
  }

  /** POST / — create a record. Pass distribution: "distributed_v2" for no-trust mode. */
  create(opts: CreateOpts): Promise<ShieldRecord> {
    return this.req<ShieldRecord>("POST", "/", { body: opts });
  }

  /** GET / (or /records) — paginated list. */
  list(opts: ListOpts = {}): Promise<ListResponse> {
    const q = new URLSearchParams();
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    if (opts.offset !== undefined) q.set("offset", String(opts.offset));
    if (opts.mine) q.set("mine", "1");
    const qs = q.toString();
    return this.req<ListResponse>("GET", qs ? `/?${qs}` : "/");
  }

  /** GET /:id */
  get(id: string): Promise<ShieldRecord> {
    return this.req<ShieldRecord>("GET", `/${encodeURIComponent(id)}`);
  }

  /** GET /:id/public */
  getPublic(id: string): Promise<PublicProjection> {
    return this.req<PublicProjection>("GET", `/${encodeURIComponent(id)}/public`, {
      auth: false,
    });
  }

  /** GET /:id/witness — only available for distributed_v2 records. */
  getWitness(id: string): Promise<WitnessShard> {
    return this.req<WitnessShard>("GET", `/${encodeURIComponent(id)}/witness`, {
      auth: false,
    });
  }

  /**
   * POST /:id/reconstruct — Lagrange interpolation + Ed25519 probe-sign.
   * Pass `idempotencyKey` to make retries safe (no double-bump of verifiedCount).
   */
  reconstruct(
    id: string,
    shards: AuthenticatedShard[],
    opts: { idempotencyKey?: string } = {},
  ): Promise<ReconstructResult> {
    const headers: Record<string, string> = {};
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    return this.req<ReconstructResult>(
      "POST",
      `/${encodeURIComponent(id)}/reconstruct`,
      { body: { shards }, headers },
    );
  }

  /** POST /:id/revoke — owner or admin only. */
  revoke(
    id: string,
    opts: { reason?: string } = {},
  ): Promise<{
    success: boolean;
    shieldId: string;
    status: "revoked" | "already-revoked";
    revokedAt?: string;
  }> {
    return this.req("POST", `/${encodeURIComponent(id)}/revoke`, { body: opts });
  }

  /** GET /:id/audit — owner or admin only. */
  audit(
    id: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{
    shieldId: string;
    entries: AuditEntry[];
    limit: number;
    offset: number;
  }> {
    const q = new URLSearchParams();
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    if (opts.offset !== undefined) q.set("offset", String(opts.offset));
    const qs = q.toString();
    return this.req(
      "GET",
      `/${encodeURIComponent(id)}/audit${qs ? "?" + qs : ""}`,
    );
  }

  /** DELETE /:id — owner or admin only. Hard delete. */
  delete(id: string): Promise<{ success: boolean; deleted: string }> {
    return this.req("DELETE", `/${encodeURIComponent(id)}`);
  }
}

/**
 * Convenience: load shards from arbitrary JSON shapes the dashboard exports.
 * Accepts:
 *   - a single shard object
 *   - an array of shard objects
 *   - a bundle { shards: [...] }
 *   - a per-shard download { shieldId, shard, ... }
 */
export function parseShardSource(input: unknown): AuthenticatedShard[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return input.filter(isAuthShard);
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.shards)) {
      return (obj.shards as unknown[]).filter(isAuthShard);
    }
    if (obj.shard && isAuthShard(obj.shard)) {
      return [obj.shard as AuthenticatedShard];
    }
    if (isAuthShard(obj)) {
      return [obj as AuthenticatedShard];
    }
  }
  return [];
}

function isAuthShard(x: unknown): x is AuthenticatedShard {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.index === "number" &&
    typeof o.sssShare === "string" &&
    typeof o.hmac === "string" &&
    typeof o.hmacKeyVersion === "number"
  );
}
