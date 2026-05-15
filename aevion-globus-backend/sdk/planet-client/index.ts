/**
 * @aevion/planet-client — TypeScript client for AEVION Planet compliance.
 *
 * Zero-dependency. Wraps /api/planet/* — pipeline of validators (canonization
 * → checks → evidenceRoot → signed certificate), public artifact registry,
 * voting + Music/Film awards.
 *
 *   import { PlanetClient } from "@aevion/planet-client";
 *   const planet = new PlanetClient({ baseUrl, token });
 *   const stats = await planet.stats();
 *   const recent = await planet.recentArtifacts({ artifactType: "music", limit: 10 });
 */

export type ArtifactType = "movie" | "music" | "code" | "web";
export type SubmissionStatus = "passed" | "flagged" | "rejected";

export type Validator = {
  validatorId: string;
  status: SubmissionStatus;
  publicExplanation?: unknown;
  evidenceRefs?: unknown;
  resubmitPolicy?: { allowed: boolean; requiredChangeDescription: string };
  metrics?: unknown;
  threshold?: unknown;
};

export type SubmissionResponse = {
  submissionId: string;
  artifactVersionId: string;
  status: SubmissionStatus;
  evidenceRoot: string;
  validators: Validator[];
  certificate?: unknown;
};

export type SubmissionInput = {
  artifactType: ArtifactType;
  title: string;
  productKey: string;
  tier?: string;
  declaredLicense?: string;
  generationParams?: Record<string, unknown>;
  mediaFingerprint?: string;
  mediaDescriptor?: { artist?: string; isrc?: string; durationSec?: number };
  codeFiles?: Array<{ path: string; content: string }>;
};

export type StatsResponse = {
  eligibleParticipants: number;
  distinctVotersAllTime: number;
  submissions: number;
  artifactVersions: number;
  certifiedArtifactVersions: number;
  shieldedObjects?: number;
  scopedToProductKeyPrefix: {
    productKeyPrefix: string;
    submissions: number;
    artifactVersions: number;
    certifiedArtifactVersions: number;
  } | null;
  generatedAt: string;
};

export type RecentArtifact = {
  artifactVersionId: string;
  artifactType: ArtifactType;
  title: string;
  productKey: string;
  certifiedAt: string;
  votes?: number;
  rating?: number;
};

export type PublicArtifactView = {
  artifactVersionId: string;
  artifactType: ArtifactType;
  title: string;
  productKey: string;
  declaredLicense?: string;
  evidenceRoot: string;
  certificate?: unknown;
  votes: number;
  voteStatsByCategory: Record<string, { count: number; avg: number }>;
};

export type VoteInput = {
  artifactVersionId: string;
  category?: string;
  rating?: number;
};

export class PlanetError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `Planet API error ${status}`);
    this.name = "PlanetError";
    this.status = status;
    this.body = body;
  }
}

export interface PlanetClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class PlanetClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: PlanetClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/planet").replace(/\/+$/, "");
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
        throw new PlanetError(
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

  /** GET /stats — public participant + voting metrics. */
  stats(productKeyPrefix?: string): Promise<StatsResponse> {
    const qs = productKeyPrefix
      ? `?productKeyPrefix=${encodeURIComponent(productKeyPrefix)}`
      : "";
    return this.req<StatsResponse>("GET", `/stats${qs}`, { auth: false });
  }

  /** GET /artifacts/recent */
  recentArtifacts(opts: {
    productKeyPrefix?: string;
    artifactType?: ArtifactType;
    limit?: number;
    sort?: "created" | "rating" | "votes";
  } = {}): Promise<{ items: RecentArtifact[]; total: number }> {
    const q = new URLSearchParams();
    if (opts.productKeyPrefix) q.set("productKeyPrefix", opts.productKeyPrefix);
    if (opts.artifactType) q.set("artifactType", opts.artifactType);
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    if (opts.sort) q.set("sort", opts.sort);
    const qs = q.toString();
    return this.req("GET", qs ? `/artifacts/recent?${qs}` : "/artifacts/recent", {
      auth: false,
    });
  }

  /** GET /artifacts/:artifactVersionId/public */
  publicArtifact(artifactVersionId: string): Promise<PublicArtifactView> {
    return this.req<PublicArtifactView>(
      "GET",
      `/artifacts/${encodeURIComponent(artifactVersionId)}/public`,
      { auth: false },
    );
  }

  /** POST /submissions — full validators pipeline. */
  submit(input: SubmissionInput): Promise<SubmissionResponse> {
    return this.req<SubmissionResponse>("POST", "/submissions", { body: input });
  }

  /** POST /vote — cast a vote on an artifact version. */
  vote(input: VoteInput): Promise<{ ok: true; voteId: string }> {
    return this.req("POST", "/vote", { body: input });
  }

  /** GET /awards/:type — current results for music/film/code/etc. */
  awards(type: ArtifactType, opts: { season?: string; limit?: number } = {}): Promise<unknown> {
    const q = new URLSearchParams();
    if (opts.season) q.set("season", opts.season);
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return this.req(
      "GET",
      qs
        ? `/awards/${encodeURIComponent(type)}?${qs}`
        : `/awards/${encodeURIComponent(type)}`,
      { auth: false },
    );
  }
}
