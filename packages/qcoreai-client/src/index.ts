/**
 * @aevion/qcoreai-client — TypeScript client for AEVION QCoreAI multi-agent.
 *
 * Single-file SDK that wraps the public HTTP API:
 *   - POST /api/qcoreai/multi-agent             (SSE streaming pipeline)
 *   - POST /api/qcoreai/runs/:id/refine         (one-pass surgical edit)
 *   - GET  /api/qcoreai/search?q=...            (substring/tags)
 *   - GET  /api/qcoreai/tags?limit=...          (top tags)
 *   - PATCH /api/qcoreai/runs/:id/tags          (replace tags)
 *   - GET  /api/qcoreai/analytics               (KPIs)
 *   - GET  /api/qcoreai/analytics/timeseries    (daily cost/runs buckets)
 *   - PUT/GET/DELETE /api/qcoreai/me/webhook    (per-user webhook config)
 *
 * Plus utilities for webhook receivers (HMAC verification).
 *
 * @example
 * ```ts
 * import { QCoreClient } from "@aevion/qcoreai-client";
 *
 * const client = new QCoreClient({
 *   baseUrl: "https://api.aevion.io",
 *   token: process.env.AEVION_TOKEN,
 * });
 *
 * // 1. Sync — collect the entire stream into a final answer.
 * const { finalContent, runId, totalCostUsd } = await client.runSync({
 *   input: "Compare Postgres vs DynamoDB for an event-sourced ledger.",
 *   strategy: "sequential",
 * });
 *
 * // 2. Stream — yield each orchestrator event as it arrives.
 * for await (const evt of client.runStream({ input: "...", strategy: "debate" })) {
 *   if (evt.type === "agent_chunk") process.stdout.write(evt.delta);
 *   if (evt.type === "run_complete") console.log("\nDONE", evt.totalCostUsd);
 * }
 *
 * // 3. Refine an existing run.
 * await client.refine(runId, "Add a TL;DR at the top.");
 *
 * // 4. Tag and search.
 * await client.setTags(runId, ["investor-deck", "ledger-research"]);
 * const hits = await client.search("ledger");
 * ```
 */

/* ═══════════════════════════════════════════════════════════════════════
   Public types — mirror the server's OrchestratorEvent + REST payloads.
   ═══════════════════════════════════════════════════════════════════════ */

export type Strategy = "sequential" | "parallel" | "debate";
export type AgentRole = "analyst" | "writer" | "critic";
export type ConfigRoleId = "analyst" | "writer" | "writerB" | "critic";

export type AgentOverride = {
  provider?: string;
  model?: string;
  temperature?: number;
};

export type RunOptions = {
  /** User prompt. Required. */
  input: string;
  /** Pipeline strategy. Defaults to "sequential". */
  strategy?: Strategy;
  /** Per-role provider/model/temperature overrides. */
  overrides?: Partial<Record<ConfigRoleId, AgentOverride>>;
  /** Number of critic→writer revision rounds in sequential. 0..2, default 0. */
  maxRevisions?: number;
  /** Reuse an existing session (multi-turn context). */
  sessionId?: string;
  /** QRight object IDs to attach as tool context. */
  attachmentIds?: string[];
  /** Per-run hard budget (USD). Run gets status="capped" if crossed. */
  maxCostUsd?: number;
  /** Run tags (drives /tags chip strip and /search). */
  tags?: string[];
};

export type OrchestratorEvent =
  | { type: "session"; sessionId: string; runId: string }
  | { type: "qright_attached"; items: Array<{ id: string; title: string; kind: string }> }
  | { type: "agent_start"; role: AgentRole; stage: string; instance?: string; provider: string; model: string }
  | { type: "agent_chunk"; role: AgentRole; stage: string; instance?: string; delta: string }
  | { type: "agent_end"; role: AgentRole; stage: string; instance?: string; tokensIn: number | null; tokensOut: number | null; durationMs: number; costUsd: number | null; content: string }
  | { type: "verdict"; approved: boolean; feedback: string }
  | { type: "guidance_applied"; nextRole: string; nextStage: string; text: string }
  | { type: "cost_cap_set"; capUsd: number }
  | { type: "cost_cap_hit"; spentUsd: number; capUsd: number }
  | { type: "run_complete"; finalContent: string; status: "done" | "stopped" | "error" | "capped"; totalDurationMs: number; totalCostUsd: number }
  | { type: "error"; message: string };

export type SearchHit = {
  runId: string;
  sessionId: string;
  sessionTitle: string;
  strategy: string | null;
  status: string;
  startedAt: string;
  totalCostUsd: number | null;
  preview: string;
  matched: "input" | "final" | "title" | "tag";
};

export type RunSyncResult = {
  runId: string;
  sessionId: string;
  finalContent: string;
  status: "done" | "stopped" | "error" | "capped";
  totalDurationMs: number;
  totalCostUsd: number;
  budgetExceeded?: { spentUsd: number; capUsd: number };
  events: OrchestratorEvent[];
};

export type ClientOptions = {
  /** Base URL of the AEVION backend, e.g. "https://api.aevion.io". */
  baseUrl: string;
  /** Optional bearer JWT — required for owner-scoped endpoints (runs, tags, webhook). */
  token?: string;
  /** Default fetch implementation (Node ≥18 has global fetch). */
  fetch?: typeof fetch;
};

/* ═══════════════════════════════════════════════════════════════════════
   QCoreClient — the main entry point.
   ═══════════════════════════════════════════════════════════════════════ */

export class QCoreClient {
  private baseUrl: string;
  private token?: string;
  private fetchImpl: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.fetchImpl = opts.fetch || (globalThis as any).fetch;
    if (!this.fetchImpl) {
      throw new Error("@aevion/qcoreai-client: no fetch implementation found. Pass `fetch` in ClientOptions or run on Node 18+.");
    }
  }

  /** Convenience setter — useful when token is fetched async after construction. */
  setToken(token: string | undefined): void {
    this.token = token;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private headers(extra?: HeadersInit): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    if (extra) Object.assign(h, extra);
    return h;
  }

  /** Buffer the entire SSE stream into a single result object. */
  async runSync(opts: RunOptions): Promise<RunSyncResult> {
    const events: OrchestratorEvent[] = [];
    let runId = "";
    let sessionId = "";
    let finalContent = "";
    let status: RunSyncResult["status"] = "done";
    let totalCostUsd = 0;
    let totalDurationMs = 0;
    let budgetExceeded: RunSyncResult["budgetExceeded"];

    for await (const evt of this.runStream(opts)) {
      events.push(evt);
      if (evt.type === "session") {
        runId = evt.runId;
        sessionId = evt.sessionId;
      } else if (evt.type === "run_complete") {
        finalContent = evt.finalContent;
        status = evt.status;
        totalCostUsd = evt.totalCostUsd;
        totalDurationMs = evt.totalDurationMs;
      } else if (evt.type === "cost_cap_hit") {
        budgetExceeded = { spentUsd: evt.spentUsd, capUsd: evt.capUsd };
      } else if (evt.type === "error") {
        status = "error";
      }
    }
    return { runId, sessionId, finalContent, status, totalDurationMs, totalCostUsd, budgetExceeded, events };
  }

  /** Async-iterate the SSE stream; yields each OrchestratorEvent. */
  async *runStream(opts: RunOptions): AsyncGenerator<OrchestratorEvent> {
    const body = JSON.stringify({
      userInput: opts.input,
      strategy: opts.strategy || "sequential",
      overrides: opts.overrides,
      maxRevisions: opts.maxRevisions,
      sessionId: opts.sessionId,
      attachmentIds: opts.attachmentIds,
      maxCostUsd: opts.maxCostUsd,
      tags: opts.tags,
    });

    const res = await this.fetchImpl(this.url("/api/qcoreai/multi-agent"), {
      method: "POST",
      headers: this.headers({ Accept: "text/event-stream" }),
      body,
    });

    if (!res.ok || !res.body) {
      const msg = await safeError(res);
      throw new Error(`runStream failed: ${msg}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        // SSE: events are separated by \n\n (or \r\n\r\n).
        while ((nlIdx = indexOfDoubleNewline(buffer)) !== -1) {
          const raw = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx).replace(/^[\r\n]+/, "");
          const dataLines = raw.split(/\r?\n/).filter((l) => l.startsWith("data: "));
          if (dataLines.length === 0) continue;
          const payload = dataLines.map((l) => l.slice(6)).join("\n");
          if (!payload.trim()) continue;
          try {
            const evt = JSON.parse(payload) as OrchestratorEvent;
            yield evt;
          } catch {
            // Ignore malformed events.
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
  }

  /** One-pass surgical edit on top of an already-finished run. */
  async refine(runId: string, instruction: string, opts?: { provider?: string; model?: string; temperature?: number }): Promise<{
    content: string;
    runTotalCostUsd: number | null;
    runTotalDurationMs: number | null;
    costUsd: number | null;
    durationMs: number;
  }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/runs/${encodeURIComponent(runId)}/refine`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ instruction, ...(opts || {}) }),
    });
    if (!res.ok) throw new Error(`refine failed: ${await safeError(res)}`);
    const data = await res.json();
    return {
      content: data.content,
      runTotalCostUsd: data.runTotalCostUsd ?? null,
      runTotalDurationMs: data.runTotalDurationMs ?? null,
      costUsd: data.costUsd ?? null,
      durationMs: data.durationMs ?? 0,
    };
  }

  /** Replace a run's tags. Owner-only. Server normalizes (trim, dedupe, cap 16x32). */
  async setTags(runId: string, tags: string[]): Promise<string[]> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/runs/${encodeURIComponent(runId)}/tags`), {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) throw new Error(`setTags failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.tags || [];
  }

  /** Substring search across the user's runs (input/final/title/tags). */
  async search(query: string, limit = 30): Promise<SearchHit[]> {
    const url = this.url(`/api/qcoreai/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    const res = await this.fetchImpl(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`search failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Top tags across the user's runs, sorted by count. */
  async topTags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/tags?limit=${limit}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`topTags failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Daily run+cost timeseries (powers cost forecasting). */
  async timeseries(days = 30): Promise<Array<{ date: string; runs: number; costUsd: number }>> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/analytics/timeseries?days=${days}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`timeseries failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Set the per-user run.completed webhook. */
  async setUserWebhook(url: string, secret?: string): Promise<{ url: string; hasSecret: boolean }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/me/webhook`), {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({ url, secret }),
    });
    if (!res.ok) throw new Error(`setUserWebhook failed: ${await safeError(res)}`);
    return await res.json();
  }

  /** Disable the user's webhook. */
  async deleteUserWebhook(): Promise<void> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/me/webhook`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`deleteUserWebhook failed: ${await safeError(res)}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Webhook receiver helpers — HMAC verification.
   The server signs every webhook body with HMAC-SHA256 using the secret
   you set via PUT /me/webhook. Headers:
     - X-QCore-Signature: hex-encoded HMAC
     - X-QCore-Origin: "env" | "user"
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Constant-time HMAC verification for QCoreAI run.completed webhooks.
 * Pass the raw request body (Buffer or string), the provided signature
 * header, and your shared secret. Returns true if the signature matches.
 *
 * Works in both Node and Edge — uses Web Crypto SubtleCrypto.
 *
 * @example
 * ```ts
 * import { verifyWebhookHmac } from "@aevion/qcoreai-client";
 *
 * app.post("/qcore-webhook", express.raw({ type: "*\/*" }), async (req, res) => {
 *   const ok = await verifyWebhookHmac(
 *     req.body,
 *     req.headers["x-qcore-signature"],
 *     process.env.QCORE_WEBHOOK_SECRET!
 *   );
 *   if (!ok) return res.status(401).end();
 *   const evt = JSON.parse(req.body.toString("utf8"));
 *   console.log("run.completed", evt.runId, evt.status, evt.totalCostUsd);
 *   res.json({ ok: true });
 * });
 * ```
 */
export async function verifyWebhookHmac(
  rawBody: string | Uint8Array,
  signature: string | string[] | undefined,
  secret: string
): Promise<boolean> {
  if (!signature || Array.isArray(signature)) return false;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const bodyBytes = typeof rawBody === "string" ? encoder.encode(rawBody) : new Uint8Array(rawBody);
  const keyBytes = encoder.encode(secret);

  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) {
    throw new Error("@aevion/qcoreai-client: Web Crypto SubtleCrypto unavailable. Use Node 18+ or a modern runtime.");
  }

  // Copy into fresh ArrayBuffers to satisfy strict BufferSource typing
  // (rules out SharedArrayBuffer in some lib.dom configurations).
  const keyBuf = new Uint8Array(keyBytes).buffer;
  const bodyBuf = new Uint8Array(bodyBytes).buffer;

  const key = await subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await subtle.sign("HMAC", key, bodyBuf);
  const expected = bytesToHex(new Uint8Array(sigBytes));

  // Constant-time compare to prevent timing oracles.
  return constantTimeEqual(expected, signature.toLowerCase().trim());
}

/* ═══════════════════════════════════════════════════════════════════════
   Internals
   ═══════════════════════════════════════════════════════════════════════ */

async function safeError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function indexOfDoubleNewline(s: string): number {
  const a = s.indexOf("\n\n");
  const b = s.indexOf("\r\n\r\n");
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function bytesToHex(buf: Uint8Array): string {
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += buf[i].toString(16).padStart(2, "0");
  }
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
