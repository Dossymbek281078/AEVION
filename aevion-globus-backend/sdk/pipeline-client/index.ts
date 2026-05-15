/**
 * @aevion/pipeline-client — TypeScript client for the AEVION IP Pipeline.
 *
 * Zero dependencies. Uses global fetch (Node 18+, browsers, Bun, Deno).
 * Wraps /api/pipeline/* — the central protect → certify → verify pipeline
 * that combines QSign HMAC, Ed25519 author co-signing, Shamir 2-of-3,
 * Quantum Shield, and OpenTimestamps Bitcoin anchoring.
 *
 * Example:
 *
 *   import { PipelineClient } from "@aevion/pipeline-client";
 *   const p = new PipelineClient({
 *     baseUrl: "https://aevion-production-a70c.up.railway.app/api/pipeline",
 *     token: process.env.AEVION_TOKEN,
 *   });
 *   const protect = await p.protect({
 *     title: "My masterpiece",
 *     kind: "music",
 *     description: "An original composition.",
 *     authorName: "Alice",
 *     country: "KZ",
 *     city: "Almaty",
 *     payload: { fileSha256: "abcd..." },
 *   });
 *   // shieldId is auto-created in distributed_v2 mode; save shard 1 offline.
 *   const verdict = await p.verify(protect.certificate.id);
 */

export type Kind = "music" | "code" | "design" | "text" | "video" | "idea" | "other";

export type DistributionPolicy = "legacy_all_local" | "distributed_v2";

export type AuthenticatedShard = {
  index: number;
  sssShare: string;
  hmac: string;
  hmacKeyVersion: number;
  location?: string;
  createdAt?: string;
};

export type ProtectInput = {
  title: string;
  kind?: Kind;
  description?: string;
  authorName?: string;
  authorEmail?: string;
  country?: string;
  city?: string;
  payload?: unknown;
  /** Optional client-side Ed25519 author signature for trust-on-first-use. */
  authorPublicKey?: string;
  authorSignature?: string;
  authorKeyAlgo?: string;
};

export type CertificateView = {
  id: string;
  objectId: string;
  shieldId?: string | null;
  title: string;
  kind: string;
  description: string;
  author: string;
  email?: string | null;
  location?: string | null;
  contentHash: string;
  signatureHmac: string;
  signatureEd25519?: string | null;
  algorithm: string;
  protectedAt: string;
  status: string;
  verificationLevel?: "anonymous" | "verified";
  verifiedName?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
};

export type ProtectResponse = {
  shield: {
    id: string;
    shards: AuthenticatedShard[];
    publicKey: string;
    signature: string;
    threshold: number;
    totalShards: number;
    distribution: DistributionPolicy;
    witnessCid?: string | null;
    witnessUrl?: string | null;
  };
  certificate: CertificateView;
  legalBasis?: unknown;
};

export type VerifyResponse = {
  valid: boolean;
  verified: boolean;
  verifiedAt: string;
  certificate: CertificateView;
  integrity: {
    contentHashValid: boolean;
    signatureHmacValid: boolean | null;
    signatureHmacReason?: "OK" | "NO_SIGNED_AT" | "MISMATCH" | "ERROR";
    qsignKeyVersion?: number;
    currentKeyVersion?: number;
    keyRotatedSinceSigning?: boolean;
    quantumShieldStatus: string;
    shieldLegacy?: boolean;
    shieldId?: string | null;
    shards: number;
    threshold: number;
    authorCosign?:
      | { present: false }
      | { present: true; valid: boolean; fingerprint: string };
  };
  bitcoinAnchor?: {
    status: "pending" | "bitcoin-confirmed" | "failed" | "not_stamped";
    bitcoinBlockHeight: number | null;
    stampedAt: string | null;
    upgradedAt: string | null;
    hasProof: boolean;
    network: string;
    proofUrl: string | null;
    upgradeUrl: string | null;
  };
  shardDistribution?: {
    policy: "legacy_all_local" | "distributed_v2";
    realDistributed: boolean;
    locations: Array<{
      index: number;
      place: string;
      held: string;
      serverHasCopy: boolean;
      cid?: string;
      cidValid?: boolean;
    }>;
    witness: {
      cid: string;
      cidValid: boolean;
      witnessUrl: string;
    } | null;
  };
  legalBasis: unknown;
  stats: { verifiedCount: number; lastVerifiedAt: string };
};

export type ReconstructResult =
  | {
      ok: true;
      reconstructed: true;
      shieldId: string;
      verifiedAt: string;
    }
  | {
      ok: false;
      reconstructed: false;
      reason: string;
    };

export type CertificatesPage = {
  certificates: Array<{
    id: string;
    title: string;
    kind: string;
    author: string;
    location: string | null;
    contentHash: string;
    algorithm: string;
    protectedAt: string;
    verifiedCount: number;
    shieldId?: string | null;
    verifyUrl: string;
  }>;
  total: number;
};

export type WitnessShard = {
  shieldId: string;
  shard: AuthenticatedShard;
  cid: string;
  createdAt: string;
};

export type OtsUpgradeResult = {
  upgraded: boolean;
  bitcoinBlockHeight?: number;
  note?: string;
};

export class PipelineError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `Pipeline API error ${status}`);
    this.name = "PipelineError";
    this.status = status;
    this.body = body;
  }
}

export interface PipelineClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class PipelineClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: PipelineClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/pipeline").replace(/\/+$/, "");
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
      raw,
    }: {
      body?: unknown;
      headers?: Record<string, string>;
      auth?: boolean;
      raw?: boolean;
    } = {},
  ): Promise<T> {
    const reqHeaders: Record<string, string> = {
      Accept: raw ? "application/octet-stream" : "application/json",
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
      if (raw) {
        if (!res.ok) {
          throw new PipelineError(
            res.status,
            null,
            `${method} ${path} failed: HTTP ${res.status}`,
          );
        }
        return (await res.arrayBuffer()) as unknown as T;
      }
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        /* no body */
      }
      if (!res.ok) {
        throw new PipelineError(
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
  health(): Promise<{ status: string; service: string; timestamp: string }> {
    return this.req("GET", "/health", { auth: false });
  }

  /** POST /protect — full protect → certify pipeline. */
  protect(input: ProtectInput): Promise<ProtectResponse> {
    return this.req<ProtectResponse>("POST", "/protect", { body: input });
  }

  /** GET /verify/:certId — full integrity verdict. */
  verify(certId: string): Promise<VerifyResponse> {
    return this.req<VerifyResponse>(
      "GET",
      `/verify/${encodeURIComponent(certId)}`,
      { auth: false },
    );
  }

  /** GET /certificates — public registry (latest 100). */
  certificates(): Promise<CertificatesPage> {
    return this.req<CertificatesPage>("GET", "/certificates", { auth: false });
  }

  /** POST /reconstruct — Lagrange + probe-sign over a pipeline shieldId. */
  reconstruct(
    shieldId: string,
    shards: AuthenticatedShard[],
  ): Promise<ReconstructResult> {
    return this.req("POST", "/reconstruct", { body: { shieldId, shards } });
  }

  /** GET /shield/:shieldId/witness — public witness shard for distributed_v2. */
  witness(shieldId: string): Promise<WitnessShard> {
    return this.req<WitnessShard>(
      "GET",
      `/shield/${encodeURIComponent(shieldId)}/witness`,
      { auth: false },
    );
  }

  /**
   * GET /certificate/:certId/bundle.json — self-contained verification bundle
   * (canonical inputs + Ed25519 signature + author cosign + OTS proof).
   */
  bundle(certId: string): Promise<unknown> {
    return this.req(
      "GET",
      `/certificate/${encodeURIComponent(certId)}/bundle.json`,
      { auth: false },
    );
  }

  /** GET /certificate/:certId/pdf — pre-rendered PDF certificate (binary). */
  pdf(certId: string): Promise<ArrayBuffer> {
    return this.req<ArrayBuffer>(
      "GET",
      `/certificate/${encodeURIComponent(certId)}/pdf`,
      { auth: false, raw: true },
    );
  }

  /** GET /ots/:certId/proof — OpenTimestamps .ots binary proof. */
  otsProof(certId: string): Promise<ArrayBuffer> {
    return this.req<ArrayBuffer>(
      "GET",
      `/ots/${encodeURIComponent(certId)}/proof`,
      { auth: false, raw: true },
    );
  }

  /** POST /ots/:certId/upgrade — trigger Bitcoin confirmation upgrade. */
  otsUpgrade(certId: string): Promise<OtsUpgradeResult> {
    return this.req<OtsUpgradeResult>(
      "POST",
      `/ots/${encodeURIComponent(certId)}/upgrade`,
      { auth: false },
    );
  }

  /** GET /hmac-versions — currently active + historical HMAC key versions. */
  hmacVersions(): Promise<{
    activeVersion: number;
    versions: Array<{ version: number; rotatedAt?: string }>;
  }> {
    return this.req("GET", "/hmac-versions", { auth: false });
  }
}

/**
 * Convenience: build the public verify URL for a certificate id. Useful when
 * you need to render a "Verify this work" link on a third-party website.
 */
export function publicVerifyUrl(certId: string, origin = "https://aevion.com"): string {
  return `${origin.replace(/\/+$/, "")}/verify/${encodeURIComponent(certId)}`;
}
