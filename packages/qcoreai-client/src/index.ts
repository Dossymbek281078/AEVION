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
  /**
   * Per-role custom system prompts. Either reference a saved prompt by id
   * (must be owned or public) or pass content inline. Wins over the role's
   * default prompt when present.
   */
  promptOverrides?: Partial<Record<ConfigRoleId, { promptId?: string; content?: string }>>;
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
  /** V7-T: continue an existing run in a thread — passes full thread context as history. */
  continueFromRunId?: string;
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

/* ─── Eval harness types ──────────────────────────────────────────────── */

export type EvalJudge =
  | { type: "contains"; needle: string; caseSensitive?: boolean }
  | { type: "not_contains"; needle: string; caseSensitive?: boolean }
  | { type: "equals"; expected: string; caseSensitive?: boolean; trim?: boolean }
  | { type: "regex"; pattern: string; flags?: string }
  | { type: "min_length"; chars: number }
  | { type: "max_length"; chars: number }
  | { type: "llm_judge"; rubric: string; provider?: string; model?: string; passThreshold?: number };

export type EvalCase = {
  id: string;
  name?: string;
  input: string;
  judge: EvalJudge;
  weight?: number;
};

export type EvalSuite = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  strategy: Strategy;
  overrides: Partial<Record<ConfigRoleId, AgentOverride>>;
  cases: EvalCase[];
  createdAt: string;
  updatedAt: string;
};

export type EvalCaseResult = {
  caseId: string;
  caseName: string;
  passed: boolean;
  judgeKind: string;
  reason: string;
  output: string;
  costUsd: number;
  durationMs: number;
  error?: string;
};

export type EvalRun = {
  id: string;
  suiteId: string;
  ownerUserId: string;
  status: "running" | "done" | "error" | "aborted";
  score: number | null;
  totalCases: number;
  passedCases: number;
  totalCostUsd: number;
  results: EvalCaseResult[];
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type Prompt = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  role: string;
  content: string;
  version: number;
  parentPromptId: string | null;
  isPublic: boolean;
  importCount: number;
  createdAt: string;
  updatedAt: string;
};

/* ─── V7 types ────────────────────────────────────────────────────────── */

export type Template = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  input: string;
  strategy: Strategy;
  overrides: Partial<Record<ConfigRoleId, AgentOverride>>;
  isPublic: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ThreadRun = {
  id: string;
  userInput: string;
  finalContent: string | null;
  status: string;
  strategy: string | null;
  totalCostUsd: number | null;
  startedAt: string;
  parentRunId: string | null;
  threadId: string | null;
};

export type Thread = {
  threadId: string;
  runs: ThreadRun[];
};

export type BatchRunSummary = {
  id: string;
  userInput: string;
  status: string;
  totalCostUsd: number | null;
  finalContentPreview: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type Batch = {
  id: string;
  ownerUserId: string;
  strategy: Strategy;
  overrides: Partial<Record<ConfigRoleId, AgentOverride>>;
  status: "running" | "done" | "error";
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalCostUsd: number;
  inputs: string[];
  createdAt: string;
  completedAt: string | null;
};

export type BatchDetail = {
  batch: Batch;
  runs: BatchRunSummary[];
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
      input: opts.input,
      strategy: opts.strategy || "sequential",
      overrides: opts.overrides,
      promptOverrides: opts.promptOverrides,
      maxRevisions: opts.maxRevisions,
      sessionId: opts.sessionId,
      qrightAttachmentIds: opts.attachmentIds,
      maxCostUsd: opts.maxCostUsd,
      tags: opts.tags,
      continueFromRunId: opts.continueFromRunId,
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

  /**
   * Open a WebSocket duplex run. Yields the same OrchestratorEvent stream
   * as `runStream`, but lets the caller `interject` mid-run guidance on
   * the same connection. Server endpoint: `/api/qcoreai/ws`.
   *
   * Requires `globalThis.WebSocket` (Node 22+ has it natively; older Node
   * needs the `ws` package — pass it via `opts.WebSocketImpl`). Browsers
   * have it always.
   *
   * @example
   * ```ts
   * const session = client.runWS({ input: "Plan a 30-day onboarding", strategy: "debate" });
   * setTimeout(() => session.interject("Add a TL;DR"), 3000);
   * for await (const evt of session.events) {
   *   if (evt.type === "chunk") process.stdout.write(evt.text);
   * }
   * ```
   */
  runWS(opts: RunOptions & { WebSocketImpl?: typeof WebSocket }): {
    events: AsyncGenerator<OrchestratorEvent>;
    interject: (text: string) => void;
    stop: () => void;
    close: () => void;
  } {
    const WS: any = opts.WebSocketImpl || (globalThis as any).WebSocket;
    if (!WS) {
      throw new Error("@aevion/qcoreai-client: no WebSocket implementation. Pass WebSocketImpl in opts (e.g. `import { WebSocket } from 'ws'`).");
    }
    const wsUrl = (this.baseUrl.replace(/^http/, "ws")) +
      "/api/qcoreai/ws" +
      (this.token ? `?token=${encodeURIComponent(this.token)}` : "");
    const ws = new WS(wsUrl);

    const queue: OrchestratorEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let closed = false;
    let openSent = false;

    const startMsg = {
      type: "start",
      input: opts.input,
      strategy: opts.strategy || "sequential",
      overrides: opts.overrides,
      maxRevisions: opts.maxRevisions,
      sessionId: opts.sessionId,
      maxCostUsd: opts.maxCostUsd,
    };

    ws.addEventListener("open", () => {
      openSent = true;
      ws.send(JSON.stringify(startMsg));
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const evt = JSON.parse(typeof ev.data === "string" ? ev.data : "") as OrchestratorEvent;
        queue.push(evt);
      } catch { /* ignore non-JSON */ }
      if (resolveNext) { resolveNext(); resolveNext = null; }
    });
    const finish = () => {
      closed = true;
      if (resolveNext) { resolveNext(); resolveNext = null; }
    };
    ws.addEventListener("close", finish);
    ws.addEventListener("error", finish);

    const events = (async function* (): AsyncGenerator<OrchestratorEvent> {
      while (!closed || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift() as OrchestratorEvent;
          continue;
        }
        if (closed) break;
        await new Promise<void>((r) => { resolveNext = r; });
      }
    })();

    return {
      events,
      interject: (text: string) => {
        if (ws.readyState !== 1) return;
        ws.send(JSON.stringify({ type: "interject", text }));
      },
      stop: () => {
        if (ws.readyState !== 1) return;
        ws.send(JSON.stringify({ type: "stop" }));
      },
      close: () => {
        try { ws.close(); } catch { /* ignore */ }
        finish();
      },
    };
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

  /** Agent marketplace — publish a saved preset to the public catalog. */
  async sharePreset(opts: {
    name: string;
    description?: string;
    strategy?: Strategy;
    overrides?: Record<string, AgentOverride>;
    isPublic?: boolean;
  }): Promise<{ id: string; importCount: number }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/presets/share`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`sharePreset failed: ${await safeError(res)}`);
    const data = await res.json();
    return { id: data.preset?.id, importCount: data.preset?.importCount ?? 0 };
  }

  /** Browse public presets, optional substring filter. */
  async browsePresets(query?: string, limit = 30): Promise<Array<{
    id: string;
    ownerUserId: string;
    name: string;
    description: string | null;
    strategy: string;
    overrides: any;
    importCount: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    const url = query
      ? this.url(`/api/qcoreai/presets/public?q=${encodeURIComponent(query)}&limit=${limit}`)
      : this.url(`/api/qcoreai/presets/public?limit=${limit}`);
    const res = await this.fetchImpl(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`browsePresets failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Import a public preset — bumps importCount, returns the preset row. */
  async importPreset(id: string): Promise<{
    id: string; name: string; strategy: string; overrides: any; description: string | null;
  }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/presets/${encodeURIComponent(id)}/import`), {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`importPreset failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.preset;
  }

  /** Owner-only delete on a shared preset. */
  async deletePreset(id: string): Promise<void> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/presets/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`deletePreset failed: ${await safeError(res)}`);
  }

  /** Disable the user's webhook. */
  async deleteUserWebhook(): Promise<void> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/me/webhook`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`deleteUserWebhook failed: ${await safeError(res)}`);
  }

  /* ─── Eval harness ───────────────────────────────────────────────────── */

  /** Create a new eval suite. */
  async createEvalSuite(opts: {
    name: string;
    description?: string | null;
    strategy?: Strategy;
    overrides?: Partial<Record<ConfigRoleId, AgentOverride>>;
    cases?: EvalCase[];
  }): Promise<EvalSuite> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/eval/suites"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`createEvalSuite failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.suite;
  }

  /** List the caller's eval suites (most recently updated first). */
  async listEvalSuites(limit = 50): Promise<EvalSuite[]> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/eval/suites?limit=${limit}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`listEvalSuites failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Fetch one suite (owner-only). */
  async getEvalSuite(id: string): Promise<EvalSuite> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/eval/suites/${encodeURIComponent(id)}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`getEvalSuite failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.suite;
  }

  /** Update a suite (any subset of fields). */
  async updateEvalSuite(
    id: string,
    patch: { name?: string; description?: string | null; strategy?: Strategy; overrides?: Partial<Record<ConfigRoleId, AgentOverride>>; cases?: EvalCase[] }
  ): Promise<EvalSuite> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/eval/suites/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateEvalSuite failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.suite;
  }

  /** Delete a suite + its run history. */
  async deleteEvalSuite(id: string): Promise<void> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/eval/suites/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`deleteEvalSuite failed: ${await safeError(res)}`);
  }

  /**
   * Kick off an async eval run. Resolves immediately with the in-flight
   * EvalRun row — poll `getEvalRun` until status !== "running".
   */
  async runEvalSuite(
    suiteId: string,
    opts: { concurrency?: number; perCaseMaxCostUsd?: number } = {}
  ): Promise<EvalRun> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/eval/suites/${encodeURIComponent(suiteId)}/run`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`runEvalSuite failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.run;
  }

  /** Poll one eval run for progress / final results. */
  async getEvalRun(id: string): Promise<EvalRun> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/eval/runs/${encodeURIComponent(id)}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`getEvalRun failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.run;
  }

  /** History of a suite's runs (newest first). Drives the regression chart. */
  async listSuiteRuns(suiteId: string, limit = 30): Promise<EvalRun[]> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/eval/suites/${encodeURIComponent(suiteId)}/runs?limit=${limit}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`listSuiteRuns failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /* ─── Prompts library (V6-P) ─────────────────────────────────────────── */

  /** Create a new prompt. Defaults role="writer", isPublic=false, version=1. */
  async createPrompt(opts: {
    name: string;
    content: string;
    role?: string;
    description?: string | null;
    parentPromptId?: string | null;
    isPublic?: boolean;
  }): Promise<Prompt> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/prompts"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`createPrompt failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.prompt;
  }

  /** List the caller's prompts (most recently updated first). */
  async listPrompts(limit = 100): Promise<Prompt[]> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/prompts?limit=${limit}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`listPrompts failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Browse public prompts shared by other users. No auth required. */
  async listPublicPrompts(query?: string, limit = 30): Promise<Prompt[]> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("limit", String(limit));
    const res = await this.fetchImpl(this.url(`/api/qcoreai/prompts/public?${params.toString()}`));
    if (!res.ok) throw new Error(`listPublicPrompts failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Fetch a single prompt (own or public). */
  async getPrompt(id: string): Promise<Prompt> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/prompts/${encodeURIComponent(id)}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`getPrompt failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.prompt;
  }

  /** Get all versions in a prompt's chain (ancestors + descendants). */
  async getPromptVersions(id: string): Promise<Prompt[]> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/prompts/${encodeURIComponent(id)}/versions`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`getPromptVersions failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Update prompt metadata (name/description/role/isPublic). Content is immutable — fork to edit. */
  async updatePrompt(
    id: string,
    patch: { name?: string; description?: string | null; role?: string; isPublic?: boolean }
  ): Promise<Prompt> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/prompts/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updatePrompt failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.prompt;
  }

  /** Delete one prompt version (other versions in the chain remain). */
  async deletePrompt(id: string): Promise<void> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/prompts/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`deletePrompt failed: ${await safeError(res)}`);
  }

  /**
   * Fork a prompt — your own prompts get a new version in the chain;
   * other users' public prompts get a fresh root copy in your library.
   */
  async forkPrompt(parentId: string, opts: { content?: string; name?: string } = {}): Promise<Prompt> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/prompts/${encodeURIComponent(parentId)}/fork`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`forkPrompt failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.prompt;
  }

  /* ─── V7-T: Threading ─────────────────────────────────────────────────── */

  /**
   * Fetch the full conversation thread for a run (root + all replies, ordered oldest→newest).
   * @example
   * ```ts
   * const thread = await client.getThread(runId);
   * console.log(`Thread has ${thread.runs.length} turns`);
   * ```
   */
  async getThread(runId: string): Promise<Thread> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/runs/${encodeURIComponent(runId)}/thread`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`getThread failed: ${await safeError(res)}`);
    return res.json();
  }

  /* ─── V7-Tmpl: Templates ───────────────────────────────────────────────── */

  /** Create a named template from an input + strategy + overrides bundle. */
  async createTemplate(opts: {
    name: string;
    input: string;
    description?: string | null;
    strategy?: Strategy;
    overrides?: Partial<Record<ConfigRoleId, AgentOverride>>;
    isPublic?: boolean;
  }): Promise<Template> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/templates"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`createTemplate failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.template;
  }

  /** List the caller's own templates (most recently updated first). */
  async listTemplates(limit = 50): Promise<Template[]> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/templates?limit=${limit}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`listTemplates failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Browse community public templates (sorted by useCount desc). */
  async listPublicTemplates(query?: string, limit = 30): Promise<Template[]> {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    p.set("limit", String(limit));
    const res = await this.fetchImpl(this.url(`/api/qcoreai/templates/public?${p}`));
    if (!res.ok) throw new Error(`listPublicTemplates failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /** Fetch a template by id. Throws 403 if it's private and not yours. */
  async getTemplate(id: string): Promise<Template> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/templates/${encodeURIComponent(id)}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`getTemplate failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.template;
  }

  /** Update template metadata. Owner-only. */
  async updateTemplate(
    id: string,
    patch: Partial<Pick<Template, "name" | "description" | "input" | "strategy" | "overrides" | "isPublic">>
  ): Promise<Template> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/templates/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateTemplate failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.template;
  }

  /** Delete a template. Owner-only. */
  async deleteTemplate(id: string): Promise<void> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/templates/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`deleteTemplate failed: ${await safeError(res)}`);
  }

  /** Apply a template (increments useCount). Returns updated template. */
  async useTemplate(id: string): Promise<Template> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/templates/${encodeURIComponent(id)}/use`), {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`useTemplate failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.template;
  }

  /* ─── V7-B: Batch runs ─────────────────────────────────────────────────── */

  /**
   * Submit N prompts as a batch. Runs execute asynchronously (up to 5 parallel).
   * Returns immediately with batchId — poll with `getBatch` or use `waitForBatch`.
   * @example
   * ```ts
   * const { batchId } = await client.createBatch({
   *   inputs: ["Summarise X", "Compare Y vs Z", "Critique this: …"],
   *   strategy: "sequential",
   * });
   * const result = await client.waitForBatch(batchId);
   * console.log(`Done: ${result.batch.completedRuns}/${result.batch.totalRuns} runs`);
   * ```
   */
  async createBatch(opts: {
    inputs: string[];
    strategy?: Strategy;
    overrides?: Partial<Record<ConfigRoleId, AgentOverride>>;
    maxCostUsd?: number;
  }): Promise<{ batchId: string; sessionId: string; totalRuns: number; runIds: string[] }> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/batch"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`createBatch failed: ${await safeError(res)}`);
    return res.json();
  }

  /** Get current batch status and per-run summaries. */
  async getBatch(id: string): Promise<BatchDetail> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/batch/${encodeURIComponent(id)}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`getBatch failed: ${await safeError(res)}`);
    return res.json();
  }

  /** List the caller's recent batches. */
  async listBatches(limit = 30): Promise<Batch[]> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/batches?limit=${limit}`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`listBatches failed: ${await safeError(res)}`);
    const data = await res.json();
    return data.items || [];
  }

  /**
   * Poll until a batch finishes (status = "done" | "error") or timeout.
   * Polls every `pollMs` (default 3000ms).
   */
  async waitForBatch(
    id: string,
    opts: { pollMs?: number; timeoutMs?: number } = {}
  ): Promise<BatchDetail> {
    const pollMs = Math.max(500, opts.pollMs ?? 3000);
    const timeoutMs = opts.timeoutMs ?? 600_000;
    const deadline = Date.now() + timeoutMs;
    let cur = await this.getBatch(id);
    while (cur.batch.status === "running") {
      if (Date.now() > deadline) throw new Error(`waitForBatch timed out after ${timeoutMs}ms`);
      await new Promise((r) => setTimeout(r, pollMs));
      cur = await this.getBatch(id);
    }
    return cur;
  }

  /**
   * Convenience helper: kick off a run and resolve once it's complete (or
   * the timeout elapses). Polls every `pollMs` (default 1500). Throws if
   * the run errors out.
   */
  async runEvalSuiteAndWait(
    suiteId: string,
    opts: { concurrency?: number; perCaseMaxCostUsd?: number; pollMs?: number; timeoutMs?: number } = {}
  ): Promise<EvalRun> {
    const initial = await this.runEvalSuite(suiteId, {
      concurrency: opts.concurrency,
      perCaseMaxCostUsd: opts.perCaseMaxCostUsd,
    });
    const pollMs = Math.max(250, opts.pollMs ?? 1500);
    const timeoutMs = opts.timeoutMs ?? 300_000;
    const deadline = Date.now() + timeoutMs;
    let cur = initial;
    while (cur.status === "running") {
      if (Date.now() > deadline) throw new Error(`runEvalSuiteAndWait timed out after ${timeoutMs}ms`);
      await new Promise((r) => setTimeout(r, pollMs));
      cur = await this.getEvalRun(cur.id);
    }
    if (cur.status === "error") throw new Error(`eval run failed: ${cur.errorMessage || "unknown"}`);
    return cur;
  }

  /* ─── V8: cost breakdown + analytics export + comments + workspaces ── */

  /** Get per-agent cost breakdown for a run. */
  async getRunCostBreakdown(runId: string): Promise<{
    breakdown: Array<{ role: string; stage: string | null; provider: string | null; model: string | null; tokensIn: number | null; tokensOut: number | null; costUsd: number | null; durationMs: number | null }>;
    totalCostUsd: number;
    totalTokensIn: number;
    totalTokensOut: number;
    byProvider: Record<string, { calls: number; costUsd: number; tokensIn: number; tokensOut: number }>;
  }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/runs/${encodeURIComponent(runId)}/cost-breakdown`), { headers: this.headers() });
    if (!res.ok) throw new Error(`getRunCostBreakdown failed: ${await safeError(res)}`);
    return res.json();
  }

  /** Get public comments on a shared run (by share token). No auth. */
  async getSharedRunComments(token: string): Promise<Array<{ id: string; authorName: string; content: string; createdAt: string }>> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/shared/${encodeURIComponent(token)}/comments`));
    if (!res.ok) throw new Error(`getSharedRunComments failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.items || [];
  }

  /** Post a public comment on a shared run. No auth required. */
  async postSharedRunComment(token: string, content: string, authorName?: string): Promise<{ id: string; authorName: string; content: string; createdAt: string }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/shared/${encodeURIComponent(token)}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, authorName: authorName || "Anonymous" }),
    });
    if (!res.ok) throw new Error(`postSharedRunComment failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.comment;
  }

  /** Get monthly spend summary (spentUsd, limitUsd, pct, alerting, exceeded). */
  async getSpendSummary(): Promise<{ spentUsd: number; limitUsd: number | null; alertAt: number; pct: number | null; alerting: boolean; exceeded: boolean }> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/me/spend-summary"), { headers: this.headers() });
    if (!res.ok) throw new Error(`getSpendSummary failed: ${await safeError(res)}`);
    return res.json();
  }

  /** Set monthly spend limit (USD). */
  async setSpendLimit(monthlyLimitUsd: number, alertAt = 0.8): Promise<void> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/me/spend-limit"), {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({ monthlyLimitUsd, alertAt }),
    });
    if (!res.ok) throw new Error(`setSpendLimit failed: ${await safeError(res)}`);
  }

  /** Bulk delete runs (owner-scoped, up to 100 IDs). Returns count deleted. */
  async deleteRunsBulk(runIds: string[]): Promise<number> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/runs/bulk"), {
      method: "DELETE",
      headers: this.headers(),
      body: JSON.stringify({ runIds }),
    });
    if (!res.ok) throw new Error(`deleteRunsBulk failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.deleted ?? 0;
  }

  /** Create a workspace. */
  async createWorkspace(name: string, description?: string | null): Promise<{ id: string; name: string; description: string | null; ownerId: string; createdAt: string }> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/workspaces"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error(`createWorkspace failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.workspace;
  }

  /** List the caller's workspaces. */
  async listWorkspaces(): Promise<Array<{ id: string; name: string; description: string | null; ownerId: string }>> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/workspaces"), { headers: this.headers() });
    if (!res.ok) throw new Error(`listWorkspaces failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.items || [];
  }

  /** Create a scheduled batch. */
  async createScheduledBatch(opts: {
    name: string;
    inputs: string[];
    strategy?: "sequential" | "parallel" | "debate";
    schedule?: "once" | "hourly" | "daily" | "weekly";
    nextRunAt?: string;
  }): Promise<{ id: string; name: string; schedule: string; nextRunAt: string | null }> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/schedules"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`createScheduledBatch failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.schedule;
  }

  /** List the caller's scheduled batches. */
  async listScheduledBatches(): Promise<Array<{ id: string; name: string; schedule: string; nextRunAt: string | null; lastRunAt: string | null; enabled: boolean }>> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/schedules"), { headers: this.headers() });
    if (!res.ok) throw new Error(`listScheduledBatches failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.items || [];
  }

  /** Trigger a scheduled batch immediately. */
  async runScheduleNow(scheduleId: string): Promise<{ batchId: string; runIds: string[] }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/schedules/${encodeURIComponent(scheduleId)}/run-now`), {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`runScheduleNow failed: ${await safeError(res)}`);
    return res.json();
  }

  /* ─── V12: Notebook ────────────────────────────────────────────────── */

  /**
   * Save a snippet from a run to the notebook.
   * @example
   * ```ts
   * const snippet = await client.saveSnippet({
   *   runId, role: "final", content: finalContent,
   *   annotation: "Key insight for investor deck", tags: ["investor", "insight"],
   * });
   * ```
   */
  async saveSnippet(opts: {
    runId: string;
    role?: string;
    content: string;
    annotation?: string | null;
    tags?: string[];
  }): Promise<{ id: string; runId: string; role: string; content: string; annotation: string | null; tags: string[]; pinned: boolean; createdAt: string }> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/notebook"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error(`saveSnippet failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.snippet;
  }

  /** List the caller's notebook snippets with optional filters. */
  async listSnippets(opts?: { q?: string; tag?: string; pinned?: boolean; limit?: number }): Promise<Array<{ id: string; runId: string; role: string; content: string; annotation: string | null; tags: string[]; pinned: boolean; createdAt: string }>> {
    const p = new URLSearchParams();
    if (opts?.q) p.set("q", opts.q);
    if (opts?.tag) p.set("tag", opts.tag);
    if (opts?.pinned !== undefined) p.set("pinned", String(opts.pinned));
    if (opts?.limit) p.set("limit", String(opts.limit));
    const res = await this.fetchImpl(this.url(`/api/qcoreai/notebook?${p}`), { headers: this.headers() });
    if (!res.ok) throw new Error(`listSnippets failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.items || [];
  }

  /** Update a notebook snippet's annotation, tags, or pin state. */
  async updateSnippet(id: string, patch: { annotation?: string | null; tags?: string[]; pinned?: boolean }): Promise<{ id: string; pinned: boolean; annotation: string | null; tags: string[] }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/notebook/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateSnippet failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.snippet;
  }

  /** Delete a notebook snippet. */
  async deleteSnippet(id: string): Promise<void> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/notebook/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`deleteSnippet failed: ${await safeError(res)}`);
  }

  /** Get the tag cloud for the caller's notebook. */
  async notebookTagCloud(): Promise<Array<{ tag: string; count: number }>> {
    const res = await this.fetchImpl(this.url("/api/qcoreai/notebook/tags"), { headers: this.headers() });
    if (!res.ok) throw new Error(`notebookTagCloud failed: ${await safeError(res)}`);
    const d = await res.json();
    return d.items || [];
  }

  /* ─── V12: Session export ──────────────────────────────────────────── */

  /**
   * Export all runs in a session as a Markdown string.
   * Useful for archival, documentation, or LLM context injection.
   */
  async exportSessionMarkdown(sessionId: string): Promise<string> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/sessions/${encodeURIComponent(sessionId)}/export?format=md`), { headers: this.headers() });
    if (!res.ok) throw new Error(`exportSessionMarkdown failed: ${await safeError(res)}`);
    return res.text();
  }

  /**
   * Export all runs in a session as a structured JSON object.
   */
  async exportSessionJson(sessionId: string): Promise<{ session: object; runs: Array<{ run: object; messages: object[] }> }> {
    const res = await this.fetchImpl(this.url(`/api/qcoreai/sessions/${encodeURIComponent(sessionId)}/export?format=json`), { headers: this.headers() });
    if (!res.ok) throw new Error(`exportSessionJson failed: ${await safeError(res)}`);
    return res.json();
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
