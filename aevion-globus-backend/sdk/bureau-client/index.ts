/**
 * @aevion/bureau-client — TypeScript client for AEVION Bureau.
 *
 * Zero-dependency. Wraps /api/bureau/* — verified-author KYC tier upgrade,
 * organizations, transparency feed, embed/badge widgets.
 *
 *   import { BureauClient } from "@aevion/bureau-client";
 *   const bureau = new BureauClient({ baseUrl, token });
 *   const dash = await bureau.dashboard();
 *   const intent = await bureau.startVerification();
 */

export type VerificationLevel = "anonymous" | "verified";

export type Verification = {
  id: string;
  certId?: string;
  kycStatus: "pending" | "approved" | "rejected" | string;
  paymentStatus: "pending" | "paid" | "refunded" | string;
  createdAt: string;
  completedAt: string | null;
  verifiedName?: string | null;
};

export type Pricing = {
  verifiedTierCents: number;
  currency: string;
};

export type DashboardData = {
  certificates: Array<{
    id: string;
    title: string;
    kind: string;
    contentHash: string;
    protectedAt: string;
    authorVerificationLevel?: VerificationLevel;
    authorVerifiedAt?: string | null;
    authorVerifiedName?: string | null;
  }>;
  verifications: Verification[];
  pricing: Pricing;
};

export type Notary = {
  id: string;
  name: string;
  jurisdiction: string;
  online: boolean;
  rate?: number;
};

export type Organization = {
  id: string;
  name: string;
  ownerUserId: string;
  members: Array<{ userId: string; role: string; joinedAt: string }>;
  createdAt: string;
};

export class BureauError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `Bureau API error ${status}`);
    this.name = "BureauError";
    this.status = status;
    this.body = body;
  }
}

export interface BureauClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class BureauClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: BureauClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/bureau").replace(/\/+$/, "");
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
        /* allow empty */
      }
      if (!res.ok) {
        throw new BureauError(
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

  /** GET /dashboard — caller's certificates + verifications + pricing. */
  dashboard(): Promise<DashboardData> {
    return this.req<DashboardData>("GET", "/dashboard");
  }

  /** POST /verify/start — kick off KYC tier-upgrade flow. */
  startVerification(opts: {
    certId?: string;
    notaryId?: string;
  } = {}): Promise<{ verificationId: string; kycSessionUrl: string }> {
    return this.req("POST", "/verify/start", { body: opts });
  }

  /** GET /verify/status/:verificationId */
  verificationStatus(verificationId: string): Promise<Verification> {
    return this.req<Verification>(
      "GET",
      `/verify/status/${encodeURIComponent(verificationId)}`,
    );
  }

  /** POST /payment/intent */
  paymentIntent(opts: {
    verificationId: string;
    method?: "card" | "aev";
  }): Promise<{ clientSecret?: string; intentId: string; amountCents: number }> {
    return this.req("POST", "/payment/intent", { body: opts });
  }

  /** POST /upgrade/:certId — finalize tier upgrade. */
  upgrade(certId: string): Promise<{ success: boolean; certId: string; level: VerificationLevel }> {
    return this.req("POST", `/upgrade/${encodeURIComponent(certId)}`);
  }

  /** GET /notaries — public directory. */
  notaries(opts: { jurisdiction?: string } = {}): Promise<{ notaries: Notary[] }> {
    const q = new URLSearchParams();
    if (opts.jurisdiction) q.set("jurisdiction", opts.jurisdiction);
    const qs = q.toString();
    return this.req("GET", qs ? `/notaries?${qs}` : "/notaries", { auth: false });
  }

  /** GET /notaries/:id */
  notary(id: string): Promise<Notary> {
    return this.req<Notary>("GET", `/notaries/${encodeURIComponent(id)}`, {
      auth: false,
    });
  }

  /** POST /org — create organization. */
  createOrg(input: { name: string }): Promise<Organization> {
    return this.req<Organization>("POST", "/org", { body: input });
  }

  /** GET /org/mine */
  myOrgs(): Promise<{ orgs: Organization[] }> {
    return this.req("GET", "/org/mine");
  }

  /** GET /org/:id */
  getOrg(id: string): Promise<Organization> {
    return this.req<Organization>("GET", `/org/${encodeURIComponent(id)}`);
  }

  /** POST /org/:id/invite */
  inviteToOrg(orgId: string, email: string): Promise<{ inviteToken: string; expiresAt: string }> {
    return this.req("POST", `/org/${encodeURIComponent(orgId)}/invite`, {
      body: { email },
    });
  }

  /** POST /org/accept/:token */
  acceptInvite(token: string): Promise<{ success: boolean; orgId: string }> {
    return this.req("POST", `/org/accept/${encodeURIComponent(token)}`);
  }

  /** GET /transparency — chronological feed. */
  transparency(): Promise<{ entries: Array<{ id: string; event: string; createdAt: string; payload: unknown }> }> {
    return this.req("GET", "/transparency", { auth: false });
  }

  /** URL helper — embed iframe URL for a certificate. */
  embedUrl(certId: string, opts: { theme?: "light" | "dark" } = {}): string {
    const q = new URLSearchParams();
    if (opts.theme) q.set("theme", opts.theme);
    const qs = q.toString();
    return `${this.baseUrl}/cert/${encodeURIComponent(certId)}/embed${qs ? "?" + qs : ""}`;
  }

  /** URL helper — SVG badge URL for a certificate. */
  badgeUrl(certId: string, opts: { style?: "flat" | "shield" } = {}): string {
    const q = new URLSearchParams();
    if (opts.style) q.set("style", opts.style);
    const qs = q.toString();
    return `${this.baseUrl}/cert/${encodeURIComponent(certId)}/badge.svg${qs ? "?" + qs : ""}`;
  }
}
