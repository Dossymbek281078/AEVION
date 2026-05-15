/**
 * @aevion/qright-client — TypeScript client for AEVION QRight.
 *
 * Zero dependencies. Wraps /api/qright/* — public registry of authored works
 * with embed/badge widgets, transparency feed, admin tools, and webhooks.
 *
 *   import { QRightClient } from "@aevion/qright-client";
 *   const qr = new QRightClient({ baseUrl, token });
 *   const objects = await qr.listObjects({ q: "music", limit: 20 });
 *   const stats = await qr.objectStats(objects.objects[0].id);
 */

export type QRightObject = {
  id: string;
  title: string;
  kind: string;
  authorName: string;
  contentHash: string;
  protectedAt: string;
  status: "active" | "revoked";
  description?: string | null;
  authorEmail?: string | null;
  country?: string | null;
  city?: string | null;
  source?: string | null;
  embedUrl?: string;
  badgeUrl?: string;
  publicVerifyUrl?: string;
};

export type ObjectsPage = {
  objects: QRightObject[];
  total: number;
  limit: number;
  offset: number;
};

export type ObjectStats = {
  id: string;
  views: number;
  embeds: number;
  badgeRequests: number;
  lastViewedAt: string | null;
};

export type Webhook = {
  id: string;
  url: string;
  events: string;
  active: boolean;
  createdAt: string;
  lastFiredAt?: string | null;
};

export type AuditEntry = {
  id: string;
  event: string;
  actorUserId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export class QRightError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `QRight API error ${status}`);
    this.name = "QRightError";
    this.status = status;
    this.body = body;
  }
}

export interface QRightClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class QRightClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: QRightClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/qright").replace(/\/+$/, "");
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
        throw new QRightError(
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

  /** GET /objects — paginated public registry (supports filters via query). */
  listObjects(opts: {
    limit?: number;
    offset?: number;
    kind?: string;
    country?: string;
    q?: string;
  } = {}): Promise<ObjectsPage> {
    const q = new URLSearchParams();
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    if (opts.offset !== undefined) q.set("offset", String(opts.offset));
    if (opts.kind) q.set("kind", opts.kind);
    if (opts.country) q.set("country", opts.country);
    if (opts.q) q.set("q", opts.q);
    const qs = q.toString();
    return this.req<ObjectsPage>("GET", qs ? `/objects?${qs}` : "/objects", {
      auth: false,
    });
  }

  /** GET /objects/search?q=... */
  search(query: string, limit = 20): Promise<ObjectsPage> {
    const q = new URLSearchParams({ q: query, limit: String(limit) });
    return this.req<ObjectsPage>("GET", `/objects/search?${q}`, { auth: false });
  }

  /** GET /objects/:id */
  getObject(id: string): Promise<QRightObject> {
    return this.req<QRightObject>("GET", `/objects/${encodeURIComponent(id)}`, {
      auth: false,
    });
  }

  /** GET /objects/:id/stats */
  objectStats(id: string): Promise<ObjectStats> {
    return this.req<ObjectStats>(
      "GET",
      `/objects/${encodeURIComponent(id)}/stats`,
      { auth: false },
    );
  }

  /** POST /objects — register a new work (auth). */
  createObject(input: {
    title: string;
    kind: string;
    description?: string;
    authorName: string;
    authorEmail?: string;
    country?: string;
    city?: string;
    contentHash: string;
    source?: string;
  }): Promise<QRightObject> {
    return this.req<QRightObject>("POST", "/objects", { body: input });
  }

  /**
   * URL helper — embed widget for an object. Returns the URL only; consumers
   * use it as `<iframe src="...">` or open in new tab.
   */
  embedUrl(id: string, opts: { theme?: "light" | "dark"; lang?: string } = {}): string {
    const q = new URLSearchParams();
    if (opts.theme) q.set("theme", opts.theme);
    if (opts.lang) q.set("lang", opts.lang);
    const qs = q.toString();
    return `${this.baseUrl}/embed/${encodeURIComponent(id)}${qs ? "?" + qs : ""}`;
  }

  /**
   * URL helper — SVG badge for an object. Use as `<img src="...">`.
   */
  badgeUrl(id: string, opts: { style?: "flat" | "shield" } = {}): string {
    const q = new URLSearchParams();
    if (opts.style) q.set("style", opts.style);
    const qs = q.toString();
    return `${this.baseUrl}/badge/${encodeURIComponent(id)}.svg${qs ? "?" + qs : ""}`;
  }

  /** GET /transparency — chronological feed of mutations. */
  transparency(limit = 50): Promise<{
    entries: Array<{ id: string; event: string; createdAt: string; payload: unknown }>;
    total: number;
  }> {
    return this.req(
      "GET",
      `/transparency?limit=${limit}`,
      { auth: false },
    );
  }

  /** POST /revoke/:id — owner can revoke their own work. */
  revoke(
    id: string,
    opts: { reason?: string } = {},
  ): Promise<{ success: boolean; revokedAt: string }> {
    return this.req("POST", `/revoke/${encodeURIComponent(id)}`, { body: opts });
  }

  /** GET /webhooks — list mine. */
  listWebhooks(): Promise<{ webhooks: Webhook[] }> {
    return this.req("GET", "/webhooks");
  }

  /** POST /webhooks — subscribe to events for the calling user. */
  createWebhook(input: {
    url: string;
    events?: string | string[];
    secret?: string;
  }): Promise<{ id: string; url: string; events: string; secret: string }> {
    return this.req("POST", "/webhooks", { body: input });
  }

  /** DELETE /webhooks/:id */
  deleteWebhook(id: string): Promise<{ success: boolean; deleted: string }> {
    return this.req("DELETE", `/webhooks/${encodeURIComponent(id)}`);
  }

  /** Admin: GET /admin/audit (admin token required). */
  adminAudit(opts: { limit?: number; offset?: number } = {}): Promise<{
    entries: AuditEntry[];
    limit: number;
    offset: number;
  }> {
    const q = new URLSearchParams();
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    if (opts.offset !== undefined) q.set("offset", String(opts.offset));
    const qs = q.toString();
    return this.req("GET", qs ? `/admin/audit?${qs}` : "/admin/audit");
  }

  /** Admin: GET /admin/sources */
  adminSources(): Promise<{ sources: Array<{ id: string; name: string; count: number }> }> {
    return this.req("GET", "/admin/sources");
  }
}
