/**
 * @aevion/catalog-client — TypeScript client for the AEVION Hub catalog API.
 *
 * Zero dependencies. Uses global fetch (Node 18+ / all modern browsers).
 *
 * Usage:
 *   import { AevionCatalog } from "@aevion/catalog-client";
 *   const cat = new AevionCatalog();
 *   const all = await cat.list();
 *   const mvps = await cat.list({ status: "mvp" });
 *   const item = await cat.get("qpersona");
 *   const stats = await cat.stats();
 *   const csvUrl = cat.csvUrl({ status: "mvp" });
 *   const badgeUrl = cat.badgeUrl("qpersona");
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type ModuleStatus =
  | "launched"
  | "mvp"
  | "working"
  | "in_progress"
  | "research"
  | "planning"
  | "idea"
  | string;

export type ModuleKind =
  | "product"
  | "service"
  | "experiment"
  | "core"
  | "infrastructure"
  | string;

export interface RelatedModule {
  id: string;
  name: string;
  overlap: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  overlap: number;
  score: number; // 0..1 Jaccard
}

export interface NeighbourScore {
  id: string;
  name: string;
  status: string;
  overlap: number;
  score: number;
  sharedTags: string[];
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: ModuleKind;
  status: ModuleStatus;
  priority: number;
  tags: string[];
  frontend: string;
  ogImage: string;
  health: string | null;
  openapi: string | null;
  waitlist: string | null;
  status_url: string | null;
  relatedModules: RelatedModule[];
}

export interface TextMatch {
  id: string;
  name: string;
  code: string;
  status: string;
  score: number;
}

export interface DiffFieldEntry {
  key: string;
  a: unknown;
  b: unknown;
  equal: boolean;
}

export interface ModuleDiff {
  a: { id: string; name: string };
  b: { id: string; name: string };
  fields: DiffFieldEntry[];
  tags: {
    shared: string[];
    onlyA: string[];
    onlyB: string[];
    jaccard: number;
  };
}

export interface ModuleFingerprint {
  id: string;
  hash: string;        // 8-char hex
  length: number;      // canonical bytes
  generatedAt: string;
}

export interface CatalogResponse {
  total: number;
  filters: {
    status: string | null;
    tag: string | null;
    kind: string | null;
    fields?: string | null;
  };
  items: CatalogItem[];
  generatedAt: string;
}

export interface RegistryStats {
  total: number;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
  byTag: { tag: string; count: number }[];
  generatedAt: string;
}

export interface CoverageBucket {
  count: number;
  total: number;
  percent: number;
}

export interface ExtendedStatsRecentItem {
  id: string;
  code: string;
  name: string;
  status: string;
  kind: string;
  priority: number;
  touchedAt: string | null;
}

export interface ExtendedStats {
  total: number;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
  byPriority: Record<string, number>;
  topTags: { tag: string; count: number }[];
  coverage: {
    health: CoverageBucket;
    openapi: CoverageBucket;
  };
  recentActivity: ExtendedStatsRecentItem[];
  generatedAt: string;
}

export interface ModuleOfTheDay {
  date: string;        // YYYY-MM-DD
  dayOfYear: number;   // 0..365
  registrySize: number;
  module: CatalogItem;
  tomorrow: { id: string; code: string; name: string };
  generatedAt: string;
}

export interface CatalogListOptions {
  status?: string | string[];
  tag?: string | string[];
  kind?: string | string[];
  fields?: string[];
}

export interface AevionCatalogConfig {
  baseUrl?: string;
  fetch?: typeof fetch;
  /**
   * Optional headers applied to all requests (e.g. `Authorization`, `X-User-Id`).
   * Per-request headers (Accept) override these on collision.
   */
  headers?: Record<string, string>;
}

// ── v0.6 sub-domain types ───────────────────────────────────────────────────

export type QStoreSort = "popular" | "newest" | "trending" | "rating";

export interface QStoreProduct {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  rating?: number;
  ratingCount?: number;
  purchases?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface QStoreProductsResponse {
  total: number;
  sort: QStoreSort | string;
  items: QStoreProduct[];
}

export interface QStoreFeaturedResponse {
  popular: QStoreProduct[];
  trending: QStoreProduct[];
  newest: QStoreProduct[];
  topRated: QStoreProduct[];
  generatedAt?: string;
}

export interface QLearnCourseRef {
  id: string;
  slug?: string;
  title: string;
  thumbnail?: string;
  level?: string;
  durationMin?: number;
  [key: string]: unknown;
}

export interface QLearnBookmarkResult {
  ok: boolean;
  bookmarked: boolean;
  courseId: string;
}

export interface QLearnBookmarksResponse {
  total: number;
  items: QLearnCourseRef[];
}

export interface QLearnStreak {
  current: number;
  longest: number;
  totalDays: number;
  activeToday: boolean;
  lastActiveAt: string | null;
}

export interface QLearnProgressItem {
  courseId: string;
  course?: QLearnCourseRef;
  progress: number; // 0..1
  lastViewedAt?: string | null;
  completedAt?: string | null;
  [key: string]: unknown;
}

export interface QLearnProgress {
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  continueLearning: QLearnProgressItem[];
  notStarted: QLearnProgressItem[];
  completed: QLearnProgressItem[];
}

export type QEventsWhen = "upcoming" | "past" | "all";

export interface QEvent {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  online?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

export interface QEventsListResponse {
  total?: number;
  when?: QEventsWhen;
  /** Server returns `events` (legacy); SDK aliases to both for forward-compat. */
  events: QEvent[];
  items?: QEvent[];
}

export interface DevHubSnippet {
  id: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  user?: string;
  stars?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface DevHubSnippetsResponse {
  total: number;
  items: DevHubSnippet[];
}

export interface DevHubCreateSnippetInput {
  title: string;
  content: string;
  language: string;
  tags?: string[];
}

export interface DevHubStarResult {
  ok: boolean;
  starred: boolean;
  snippetId: string;
  stars: number;
}

export type PlanetActivityKind =
  | "module_update"
  | "release"
  | "post"
  | "comment"
  | "purchase"
  | "course_complete"
  | "event"
  | string;

export interface PlanetActivityItem {
  id: string;
  kind: PlanetActivityKind;
  /** ISO timestamp — server returns `at` (aliased from createdAt/revokedAt). */
  at: string;
  /** Legacy/raw timestamp alias. */
  createdAt?: string;
  ownerId?: string | null;
  ref?: string | null;
  title?: string | null;
  actor?: string | null;
  subject?: string | null;
  module?: string | null;
  url?: string | null;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PlanetActivityResponse {
  items: PlanetActivityItem[];
  count: number;
  kinds: string[];
  total?: number;
}

// ── v0.7 sub-domain types ───────────────────────────────────────────────────

export interface QCoreAIProvider {
  id: string;
  name: string;
  enabled?: boolean;
  models?: string[];
  defaultModel?: string;
  [key: string]: unknown;
}

export interface QCoreAIProvidersResponse {
  providers: QCoreAIProvider[];
  count?: number;
  [key: string]: unknown;
}

export interface QCoreAIHealthResponse {
  status: "ok" | "degraded" | "down" | string;
  providers?: Record<string, { ok: boolean; status?: number; durationMs?: number }>;
  timestamp?: string;
  [key: string]: unknown;
}

export interface QCoreAIChatMessage {
  role: "system" | "user" | "assistant" | string;
  content: string;
  [key: string]: unknown;
}

export interface QCoreAIChatRequest {
  provider?: string;
  model?: string;
  messages: QCoreAIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface QCoreAIChatResponse {
  provider?: string;
  model?: string;
  message?: QCoreAIChatMessage;
  reply?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  [key: string]: unknown;
}

export interface MultichatProvider {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | string;
  latencyMs?: number;
  lastCheckedAt?: string;
  [key: string]: unknown;
}

export interface MultichatProviderStatus {
  providers: MultichatProvider[];
  generatedAt?: string;
  [key: string]: unknown;
}

export interface MultichatPreset {
  id: string;
  name: string;
  description?: string;
  providers?: string[];
  prompt?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface MultichatPresetsResponse {
  total?: number;
  presets: MultichatPreset[];
  [key: string]: unknown;
}

export interface MultichatLaunchResponse {
  ok: boolean;
  sessionId?: string;
  presetId: string;
  providers?: string[];
  url?: string;
  [key: string]: unknown;
}

export interface QMediaTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  durationSec?: number;
  url?: string;
  cover?: string;
  tags?: string[];
  bpm?: number;
  mood?: string;
  [key: string]: unknown;
}

export interface QMediaTracksResponse {
  total?: number;
  items: QMediaTrack[];
  [key: string]: unknown;
}

export interface QMediaRecommendationsResponse {
  total?: number;
  items: QMediaTrack[];
  basedOn?: string | null;
  [key: string]: unknown;
}

export interface QMediaTrendingResponse {
  total?: number;
  items: QMediaTrack[];
  window?: string;
  [key: string]: unknown;
}

export interface CoachSession {
  id: string;
  title?: string;
  startedAt?: string;
  endedAt?: string | null;
  durationMin?: number;
  topic?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface CoachSessionsResponse {
  total?: number;
  items: CoachSession[];
  sessions?: CoachSession[];
  [key: string]: unknown;
}

export interface CoachGoal {
  id: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  completed?: boolean;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CoachGoalsResponse {
  total?: number;
  items: CoachGoal[];
  goals?: CoachGoal[];
  [key: string]: unknown;
}

export interface CoachGoalCreateInput {
  title: string;
  description?: string;
  dueDate?: string;
}

export interface CoachGoalCompleteResponse {
  ok: boolean;
  goalId: string;
  completed: boolean;
  completedAt?: string;
  [key: string]: unknown;
}

// ── Client ──────────────────────────────────────────────────────────────────

const DEFAULT_BASE = "https://api.aevion.app";

function joinCsv(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v.join(",") : v;
}

function buildQuery(opts: CatalogListOptions, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  const s = joinCsv(opts.status);
  const t = joinCsv(opts.tag);
  const k = joinCsv(opts.kind);
  if (s) params.set("status", s);
  if (t) params.set("tag", t);
  if (k) params.set("kind", k);
  if (opts.fields && opts.fields.length > 0) params.set("fields", opts.fields.join(","));
  for (const [key, val] of Object.entries(extra)) params.set(key, val);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export class AevionCatalog {
  readonly baseUrl: string;
  private readonly _fetch: typeof fetch;
  private readonly _defaultHeaders: Record<string, string>;

  /** QStore (catalogue / marketplace) sub-client. */
  readonly qstore: QStoreClient;
  /** QLearn (courses + progress) sub-client. */
  readonly qlearn: QLearnClient;
  /** QEvents (event calendar + ICS) sub-client. */
  readonly qevents: QEventsClient;
  /** DevHub (snippets + stars) sub-client. */
  readonly devhub: DevHubClient;
  /** Planet (cross-module activity feed) sub-client. */
  readonly planet: PlanetClient;
  /** QCoreAI (LLM providers / chat) sub-client (v0.7). */
  readonly qcoreai: QCoreAIClient;
  /** Multichat (multi-provider presets + provider status) sub-client (v0.7). */
  readonly multichat: MultichatClient;
  /** QMedia (recommendations / trending / tracks) sub-client (v0.7). */
  readonly qmedia: QMediaClient;
  /** Coach (sessions + goals) sub-client (v0.7). */
  readonly coach: CoachClient;

  constructor(config: AevionCatalogConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
    this._fetch =
      config.fetch ??
      (typeof fetch !== "undefined"
        ? fetch.bind(globalThis)
        : (() => {
            throw new Error(
              "global fetch is not available — pass `fetch` in config (e.g. node-fetch).",
            );
          }) as typeof fetch);
    this._defaultHeaders = { ...(config.headers ?? {}) };

    this.qstore = new QStoreClient(this);
    this.qlearn = new QLearnClient(this);
    this.qevents = new QEventsClient(this);
    this.devhub = new DevHubClient(this);
    this.planet = new PlanetClient(this);
    this.qcoreai = new QCoreAIClient(this);
    this.multichat = new MultichatClient(this);
    this.qmedia = new QMediaClient(this);
    this.coach = new CoachClient(this);
  }

  /** @internal — used by sub-clients. */
  _request<T>(
    method: string,
    path: string,
    opts: {
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      accept?: string;
      asText?: boolean;
    } = {},
  ): Promise<T> {
    const params = new URLSearchParams();
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined || v === null || v === "") continue;
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    const url = `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}${qs ? `?${qs}` : ""}`;
    const headers: Record<string, string> = {
      ...this._defaultHeaders,
      Accept: opts.accept ?? "application/json",
    };
    const init: RequestInit = { method, headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      (init as { body?: string }).body = JSON.stringify(opts.body);
    }
    return this._fetch(url, init).then(async (r) => {
      if (!r.ok) {
        throw new Error(`AevionCatalog ${method} HTTP ${r.status} on ${url}`);
      }
      if (opts.asText) return (await r.text()) as unknown as T;
      // 204 No Content support
      if (r.status === 204) return undefined as unknown as T;
      return (await r.json()) as T;
    });
  }

  /** GET /api/aevion/catalog with optional filters + field projection. */
  async list(opts: CatalogListOptions = {}): Promise<CatalogResponse> {
    const url = `${this.baseUrl}/api/aevion/catalog${buildQuery(opts)}`;
    const r = await this._fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`AevionCatalog.list HTTP ${r.status} on ${url}`);
    return (await r.json()) as CatalogResponse;
  }

  /** GET /api/aevion/catalog/:id — single-module deep lookup. */
  async get(moduleId: string): Promise<CatalogItem> {
    if (!moduleId || !/^[a-z0-9-]+$/i.test(moduleId)) {
      throw new Error(`AevionCatalog.get invalid moduleId: '${moduleId}'`);
    }
    const url = `${this.baseUrl}/api/aevion/catalog/${moduleId}`;
    const r = await this._fetch(url, { headers: { Accept: "application/json" } });
    if (r.status === 404) {
      throw new Error(`AevionCatalog.get module not found: '${moduleId}'`);
    }
    if (!r.ok) throw new Error(`AevionCatalog.get HTTP ${r.status} on ${url}`);
    return (await r.json()) as CatalogItem;
  }

  /** GET /api/aevion/registry-stats — taxonomy summary. */
  async stats(): Promise<RegistryStats> {
    const url = `${this.baseUrl}/api/aevion/registry-stats`;
    const r = await this._fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`AevionCatalog.stats HTTP ${r.status} on ${url}`);
    return (await r.json()) as RegistryStats;
  }

  /** Returns the absolute URL for CSV export with given filters. */
  csvUrl(opts: CatalogListOptions = {}): string {
    return `${this.baseUrl}/api/aevion/catalog${buildQuery(opts, { format: "csv" })}`;
  }

  /** Returns the absolute URL for markdown export with given filters. */
  markdownUrl(opts: CatalogListOptions = {}): string {
    return `${this.baseUrl}/api/aevion/catalog${buildQuery(opts, { format: "md" })}`;
  }

  /** Returns the shields.io-style SVG badge URL for given module id. */
  badgeUrl(moduleId: string): string {
    if (!/^[a-z0-9-]+$/i.test(moduleId)) {
      throw new Error(`AevionCatalog.badgeUrl invalid moduleId: '${moduleId}'`);
    }
    return `${this.baseUrl}/api/aevion/badges/${moduleId}.svg`;
  }

  /** GET /api/aevion/health — aggregate health across all modules. */
  async health(): Promise<{
    status: "ok" | "degraded" | "down";
    healthy: number;
    total: number;
    services: Record<string, { ok: boolean; status: number; durationMs: number }>;
    timestamp: string;
  }> {
    const url = `${this.baseUrl}/api/aevion/health`;
    const r = await this._fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`AevionCatalog.health HTTP ${r.status} on ${url}`);
    return r.json() as Promise<{
      status: "ok" | "degraded" | "down";
      healthy: number;
      total: number;
      services: Record<string, { ok: boolean; status: number; durationMs: number }>;
      timestamp: string;
    }>;
  }

  // ── Helpers (v0.2) ────────────────────────────────────────────────────────

  /** Modules matching one or more tags (server-side filter, returns items only). */
  async searchByTag(tag: string | string[]): Promise<CatalogItem[]> {
    const { items } = await this.list({ tag });
    return items;
  }

  /** Modules in the given status(es). */
  async byStatus(status: ModuleStatus | ModuleStatus[]): Promise<CatalogItem[]> {
    const { items } = await this.list({ status });
    return items;
  }

  /** Modules of the given kind(s). */
  async byKind(kind: ModuleKind | ModuleKind[]): Promise<CatalogItem[]> {
    const { items } = await this.list({ kind });
    return items;
  }

  /** Sugar for `byStatus(["mvp", "launched"])` — everything that's live. */
  async mvpsAndLaunched(): Promise<CatalogItem[]> {
    return this.byStatus(["mvp", "launched"]);
  }

  /** Top-N tags from registry stats (default 10). */
  async topTags(n = 10): Promise<{ tag: string; count: number }[]> {
    const s = await this.stats();
    return s.byTag.slice(0, n);
  }

  /**
   * GET /api/aevion/stats — extended platform-wide statistics.
   *
   * Adds health/openapi coverage matrix, byPriority buckets and a
   * recentActivity feed on top of /registry-stats. Accepts a `recent`
   * size (clamped 1..50 server-side, default 10).
   */
  async extendedStats(opts: { recent?: number } = {}): Promise<ExtendedStats> {
    const params = new URLSearchParams();
    if (opts.recent != null) {
      const n = Math.max(1, Math.min(50, Math.floor(opts.recent)));
      params.set("recent", String(n));
    }
    const qs = params.toString();
    const url = `${this.baseUrl}/api/aevion/stats${qs ? `?${qs}` : ""}`;
    const r = await this._fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`AevionCatalog.extendedStats HTTP ${r.status} on ${url}`);
    return (await r.json()) as ExtendedStats;
  }

  /**
   * GET /api/aevion/module-of-the-day — deterministic daily pick.
   *
   * Same module is returned for all consumers hitting the endpoint on the
   * same UTC day. Pass `date` (YYYY-MM-DD) to query a specific day, e.g.
   * for back-fill on archived posts.
   */
  async moduleOfTheDay(opts: { date?: string } = {}): Promise<ModuleOfTheDay> {
    const params = new URLSearchParams();
    if (opts.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
        throw new Error(
          `AevionCatalog.moduleOfTheDay invalid date '${opts.date}', expected YYYY-MM-DD`,
        );
      }
      params.set("date", opts.date);
    }
    const qs = params.toString();
    const url = `${this.baseUrl}/api/aevion/module-of-the-day${qs ? `?${qs}` : ""}`;
    const r = await this._fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`AevionCatalog.moduleOfTheDay HTTP ${r.status} on ${url}`);
    return (await r.json()) as ModuleOfTheDay;
  }

  // ── Graph helpers (v0.4) ───────────────────────────────────────────────────

  /** Returns the relatedModules array for a single module (server-side computed). */
  async relatedModules(id: string): Promise<RelatedModule[]> {
    const m = await this.get(id);
    return m.relatedModules ?? [];
  }

  /**
   * Build a full tag-overlap graph across the registry. Each item with its
   * top-K (default 5) related modules. Single round-trip via /catalog?fields=...
   * plus K-NN computed client-side using tag-Jaccard similarity.
   * Useful for visualisations or recommendation prototypes.
   */
  async graph(opts: { topK?: number; minOverlap?: number } = {}): Promise<GraphEdge[]> {
    const topK = opts.topK ?? 5;
    const minOverlap = opts.minOverlap ?? 0;
    const { items } = await this.list({ fields: ["id", "name", "tags"] });
    const edges: GraphEdge[] = [];
    for (const a of items) {
      const aTags = new Set(a.tags ?? []);
      if (aTags.size === 0) continue;
      const candidates: { id: string; name: string; overlap: number; score: number }[] = [];
      for (const b of items) {
        if (b.id === a.id) continue;
        const bTags = b.tags ?? [];
        let overlap = 0;
        for (const t of bTags) if (aTags.has(t)) overlap++;
        if (overlap <= minOverlap) continue;
        const union = aTags.size + bTags.length - overlap;
        const score = union > 0 ? overlap / union : 0; // Jaccard
        candidates.push({ id: b.id, name: b.name, overlap, score });
      }
      candidates.sort((x, y) => y.score - x.score || y.overlap - x.overlap);
      for (const c of candidates.slice(0, topK)) {
        edges.push({ from: a.id, to: c.id, overlap: c.overlap, score: Math.round(c.score * 1000) / 1000 });
      }
    }
    return edges;
  }

  /**
   * Find modules that share at least one tag with the given module's tags,
   * scored by Jaccard similarity. Single-source neighbour query.
   */
  async neighbours(id: string, opts: { topK?: number } = {}): Promise<NeighbourScore[]> {
    const topK = opts.topK ?? 10;
    const me = await this.get(id);
    const myTags = new Set(me.tags ?? []);
    if (myTags.size === 0) return [];
    const { items } = await this.list({ fields: ["id", "name", "status", "tags"] });
    const scored: NeighbourScore[] = [];
    for (const b of items) {
      if (b.id === id) continue;
      const bTags = b.tags ?? [];
      let overlap = 0;
      for (const t of bTags) if (myTags.has(t)) overlap++;
      if (overlap === 0) continue;
      const union = myTags.size + bTags.length - overlap;
      scored.push({
        id: b.id,
        name: b.name,
        status: b.status,
        overlap,
        score: union > 0 ? Math.round((overlap / union) * 1000) / 1000 : 0,
        sharedTags: bTags.filter((t) => myTags.has(t)),
      });
    }
    scored.sort((a, b) => b.score - a.score || b.overlap - a.overlap);
    return scored.slice(0, topK);
  }

  // ── v0.5 search + diff + fingerprint ─────────────────────────────────────

  /**
   * Substring-search across module name + code + description + tags.
   * Returns matches sorted by simple relevance (matches in name > code > tags > description).
   * Single round-trip via fields projection.
   */
  async findByText(query: string, opts: { limit?: number } = {}): Promise<TextMatch[]> {
    const limit = opts.limit ?? 20;
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const { items } = await this.list({
      fields: ["id", "code", "name", "description", "status", "tags"],
    });
    const matches: TextMatch[] = [];
    for (const m of items) {
      const name = (m.name ?? "").toLowerCase();
      const code = (m.code ?? "").toLowerCase();
      const tagsHit = (m.tags ?? []).some((t) => t.toLowerCase().includes(q));
      const descHit = (m.description ?? "").toLowerCase().includes(q);
      let score = 0;
      if (name.includes(q)) score += name === q ? 100 : name.startsWith(q) ? 50 : 30;
      if (code.includes(q)) score += code === q ? 80 : 25;
      if (tagsHit) score += 15;
      if (descHit) score += 5;
      if (score > 0) matches.push({ id: m.id, name: m.name, code: m.code, status: m.status, score });
    }
    matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return matches.slice(0, limit);
  }

  /**
   * Pairwise diff of two modules: which fields agree / differ, plus
   * tag-overlap stats. Useful for "compare module A vs B" UIs.
   */
  async diff(idA: string, idB: string): Promise<ModuleDiff> {
    const [a, b] = await Promise.all([this.get(idA), this.get(idB)]);
    const aTags = new Set(a.tags ?? []);
    const bTags = new Set(b.tags ?? []);
    const shared = [...aTags].filter((t) => bTags.has(t));
    const onlyA = [...aTags].filter((t) => !bTags.has(t));
    const onlyB = [...bTags].filter((t) => !aTags.has(t));
    const fields: DiffFieldEntry[] = [];
    const keys: (keyof CatalogItem)[] = ["status", "kind", "priority"];
    for (const k of keys) {
      fields.push({ key: k, a: a[k] as unknown, b: b[k] as unknown, equal: a[k] === b[k] });
    }
    return {
      a: { id: a.id, name: a.name },
      b: { id: b.id, name: b.name },
      fields,
      tags: { shared, onlyA, onlyB, jaccard: shared.length / (aTags.size + bTags.size - shared.length || 1) },
    };
  }

  /**
   * Stable content hash of a module's identity-defining fields. Useful
   * for cache busting / "did anything important change" checks.
   * Uses a tiny djb2-style hash — no crypto dependency.
   */
  async fingerprintModule(id: string): Promise<ModuleFingerprint> {
    const m = await this.get(id);
    const canonical = JSON.stringify({
      id: m.id,
      code: m.code,
      status: m.status,
      kind: m.kind,
      priority: m.priority,
      tags: [...(m.tags ?? [])].sort(),
    });
    const hash = djb2(canonical);
    return { id: m.id, hash, length: canonical.length, generatedAt: new Date().toISOString() };
  }

  // ── Hub aggregates (v0.3) ──────────────────────────────────────────────────

  /** GET /api/aevion/openapi.json — aggregate API index (AEVION-shaped). */
  async openapi(): Promise<OpenApiIndex> {
    const url = `${this.baseUrl}/api/aevion/openapi.json`;
    const r = await this._fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`AevionCatalog.openapi HTTP ${r.status} on ${url}`);
    const j = (await r.json()) as { aevion?: Partial<OpenApiIndex> };
    const a = j.aevion ?? {};
    return {
      name: a.name ?? "AEVION API Index",
      version: a.version ?? "0.0.0",
      description: a.description,
      modules: Array.isArray(a.modules) ? (a.modules as OpenApiModuleRef[]) : [],
      services: Array.isArray(a.services) ? (a.services as OpenApiServiceRef[]) : [],
      sdk: a.sdk as OpenApiSdkManifest | undefined,
      generatedAt: a.generatedAt ?? new Date().toISOString(),
    };
  }

  /** GET /api/aevion/sitemap.xml — parsed to SitemapEntry[] via zero-dep regex. */
  async sitemap(): Promise<SitemapEntry[]> {
    const url = `${this.baseUrl}/api/aevion/sitemap.xml`;
    const r = await this._fetch(url, { headers: { Accept: "application/xml,text/xml" } });
    if (!r.ok) throw new Error(`AevionCatalog.sitemap HTTP ${r.status} on ${url}`);
    const text = await r.text();
    return parseSitemap(text);
  }
}

// ── v0.6 sub-clients: QStore / QLearn / QEvents / DevHub / Planet ───────────

/** QStore (marketplace) sub-client. Lazy — constructed by `AevionCatalog`. */
export class QStoreClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/qstore/products?sort=popular|newest|trending|rating */
  products(opts: { sort?: QStoreSort } = {}): Promise<QStoreProductsResponse> {
    const sort = opts.sort;
    if (sort && !["popular", "newest", "trending", "rating"].includes(sort)) {
      throw new Error(`QStore.products invalid sort: '${sort}'`);
    }
    return this._root._request<QStoreProductsResponse>("GET", "/api/qstore/products", {
      query: { sort },
    });
  }

  /** GET /api/qstore/featured?limit=N — 4 buckets (popular/trending/newest/topRated). */
  featured(opts: { limit?: number } = {}): Promise<QStoreFeaturedResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts.limit != null) {
      const n = Math.max(1, Math.min(50, Math.floor(opts.limit)));
      query.limit = n;
    }
    return this._root._request<QStoreFeaturedResponse>("GET", "/api/qstore/featured", { query });
  }
}

/** QLearn (courses, bookmarks, streak, progress) sub-client. */
export class QLearnClient {
  constructor(private readonly _root: AevionCatalog) {}

  private _assertCourseId(id: string): void {
    if (!id || !/^[a-z0-9-]+$/i.test(id)) {
      throw new Error(`QLearn invalid courseId: '${id}'`);
    }
  }

  /** POST /api/qlearn/courses/:id/bookmark — add bookmark. */
  bookmark(courseId: string): Promise<QLearnBookmarkResult> {
    this._assertCourseId(courseId);
    return this._root._request<QLearnBookmarkResult>(
      "POST",
      `/api/qlearn/courses/${courseId}/bookmark`,
    );
  }

  /** DELETE /api/qlearn/courses/:id/bookmark — remove bookmark. */
  unbookmark(courseId: string): Promise<QLearnBookmarkResult> {
    this._assertCourseId(courseId);
    return this._root._request<QLearnBookmarkResult>(
      "DELETE",
      `/api/qlearn/courses/${courseId}/bookmark`,
    );
  }

  /** GET /api/qlearn/me/bookmarks — user's bookmarked courses. */
  bookmarks(): Promise<QLearnBookmarksResponse> {
    return this._root._request<QLearnBookmarksResponse>("GET", "/api/qlearn/me/bookmarks");
  }

  /** GET /api/qlearn/me/streak — learning streak summary. */
  streak(): Promise<QLearnStreak> {
    return this._root._request<QLearnStreak>("GET", "/api/qlearn/me/streak");
  }

  /** GET /api/qlearn/me/progress — full progress breakdown. */
  progress(): Promise<QLearnProgress> {
    return this._root._request<QLearnProgress>("GET", "/api/qlearn/me/progress");
  }
}

/** QEvents (event listing + ICS export) sub-client. */
export class QEventsClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/qevents/events?when=upcoming|past|all */
  list(opts: { when?: QEventsWhen } = {}): Promise<QEventsListResponse> {
    const when = opts.when;
    if (when && !["upcoming", "past", "all"].includes(when)) {
      throw new Error(`QEvents.list invalid when: '${when}'`);
    }
    return this._root._request<QEventsListResponse>("GET", "/api/qevents/events", {
      query: { when },
    });
  }

  /** GET /api/qevents/events/:id/ics — returns ICS text/calendar payload. */
  ics(eventId: string): Promise<string> {
    if (!eventId || !/^[a-z0-9-]+$/i.test(eventId)) {
      throw new Error(`QEvents.ics invalid eventId: '${eventId}'`);
    }
    return this._root._request<string>("GET", `/api/qevents/events/${eventId}/ics`, {
      accept: "text/calendar",
      asText: true,
    });
  }

  /** Returns the absolute ICS URL (no fetch). */
  icsUrl(eventId: string): string {
    if (!/^[a-z0-9-]+$/i.test(eventId)) {
      throw new Error(`QEvents.icsUrl invalid eventId: '${eventId}'`);
    }
    return `${this._root.baseUrl}/api/qevents/events/${eventId}/ics`;
  }
}

/** DevHub (snippets + stars) sub-client. */
export class DevHubClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/devhub/snippets?limit&tag&user — list snippets. */
  snippets(opts: { limit?: number; tag?: string; user?: string } = {}): Promise<DevHubSnippetsResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts.limit != null) {
      const n = Math.max(1, Math.min(200, Math.floor(opts.limit)));
      query.limit = n;
    }
    if (opts.tag) query.tag = opts.tag;
    if (opts.user) query.user = opts.user;
    return this._root._request<DevHubSnippetsResponse>("GET", "/api/devhub/snippets", { query });
  }

  /** POST /api/devhub/snippets — create a new snippet. */
  createSnippet(input: DevHubCreateSnippetInput): Promise<DevHubSnippet> {
    if (!input || typeof input.title !== "string" || input.title.trim().length === 0) {
      throw new Error(`DevHub.createSnippet missing title`);
    }
    if (typeof input.content !== "string" || input.content.length === 0) {
      throw new Error(`DevHub.createSnippet missing content`);
    }
    if (typeof input.language !== "string" || input.language.trim().length === 0) {
      throw new Error(`DevHub.createSnippet missing language`);
    }
    const body: DevHubCreateSnippetInput = {
      title: input.title,
      content: input.content,
      language: input.language,
      tags: Array.isArray(input.tags) ? input.tags : [],
    };
    return this._root._request<DevHubSnippet>("POST", "/api/devhub/snippets", { body });
  }

  /** GET /api/devhub/snippets/:id — fetch single snippet. */
  getSnippet(snippetId: string): Promise<DevHubSnippet> {
    if (!snippetId || !/^[a-z0-9-]+$/i.test(snippetId)) {
      throw new Error(`DevHub.getSnippet invalid snippetId: '${snippetId}'`);
    }
    return this._root._request<DevHubSnippet>("GET", `/api/devhub/snippets/${snippetId}`);
  }

  /** POST /api/devhub/snippets/:id/star — toggle / increment star. */
  star(snippetId: string): Promise<DevHubStarResult> {
    if (!snippetId || !/^[a-z0-9-]+$/i.test(snippetId)) {
      throw new Error(`DevHub.star invalid snippetId: '${snippetId}'`);
    }
    return this._root._request<DevHubStarResult>(
      "POST",
      `/api/devhub/snippets/${snippetId}/star`,
    );
  }
}

/** Planet (cross-module activity feed) sub-client. */
export class PlanetClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/planet/activity?limit&kinds — activity feed across all modules. */
  activity(opts: { limit?: number; kinds?: PlanetActivityKind | PlanetActivityKind[] } = {}): Promise<PlanetActivityResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts.limit != null) {
      const n = Math.max(1, Math.min(200, Math.floor(opts.limit)));
      query.limit = n;
    }
    if (opts.kinds) {
      query.kinds = Array.isArray(opts.kinds) ? opts.kinds.join(",") : String(opts.kinds);
    }
    return this._root._request<PlanetActivityResponse>("GET", "/api/planet/activity", { query });
  }
}

// ── v0.7 sub-clients: QCoreAI / Multichat / QMedia / Coach ──────────────────

/** QCoreAI (LLM providers + chat) sub-client. */
export class QCoreAIClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/qcoreai/providers — list available LLM providers. */
  providers(): Promise<QCoreAIProvidersResponse> {
    return this._root._request<QCoreAIProvidersResponse>("GET", "/api/qcoreai/providers");
  }

  /** GET /api/qcoreai/health — per-provider health snapshot. */
  health(): Promise<QCoreAIHealthResponse> {
    return this._root._request<QCoreAIHealthResponse>("GET", "/api/qcoreai/health");
  }

  /** POST /api/qcoreai/chat — single completion. */
  chat(input: QCoreAIChatRequest): Promise<QCoreAIChatResponse> {
    if (!input || !Array.isArray(input.messages) || input.messages.length === 0) {
      throw new Error("QCoreAI.chat missing messages[]");
    }
    return this._root._request<QCoreAIChatResponse>("POST", "/api/qcoreai/chat", {
      body: input,
    });
  }
}

/** Multichat (multi-provider presets + provider status) sub-client. */
export class MultichatClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/multichat/provider-status — health-style summary per provider. */
  providerStatus(): Promise<MultichatProviderStatus> {
    return this._root._request<MultichatProviderStatus>(
      "GET",
      "/api/multichat/provider-status",
    );
  }

  /** GET /api/multichat/presets — list available presets. */
  presets(): Promise<MultichatPresetsResponse> {
    return this._root._request<MultichatPresetsResponse>("GET", "/api/multichat/presets");
  }

  /** POST /api/multichat/presets/:id/launch — launch a preset, returns session. */
  launchPreset(presetId: string): Promise<MultichatLaunchResponse> {
    if (!presetId || !/^[a-z0-9-]+$/i.test(presetId)) {
      throw new Error(`Multichat.launchPreset invalid presetId: '${presetId}'`);
    }
    return this._root._request<MultichatLaunchResponse>(
      "POST",
      `/api/multichat/presets/${presetId}/launch`,
    );
  }
}

/** QMedia (recommendations / trending / tracks) sub-client. */
export class QMediaClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/qmedia/recommendations?limit=N — personalised picks. */
  recommendations(opts: { limit?: number } = {}): Promise<QMediaRecommendationsResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts.limit != null) {
      const n = Math.max(1, Math.min(100, Math.floor(opts.limit)));
      query.limit = n;
    }
    return this._root._request<QMediaRecommendationsResponse>(
      "GET",
      "/api/qmedia/recommendations",
      { query },
    );
  }

  /** GET /api/qmedia/trending — currently-trending tracks. */
  trending(): Promise<QMediaTrendingResponse> {
    return this._root._request<QMediaTrendingResponse>("GET", "/api/qmedia/trending");
  }

  /** GET /api/qmedia/tracks — full tracks listing. */
  tracks(): Promise<QMediaTracksResponse> {
    return this._root._request<QMediaTracksResponse>("GET", "/api/qmedia/tracks");
  }
}

/** Coach (sessions + goals) sub-client. */
export class CoachClient {
  constructor(private readonly _root: AevionCatalog) {}

  /** GET /api/coach/sessions — current user's coach sessions. */
  sessions(): Promise<CoachSessionsResponse> {
    return this._root._request<CoachSessionsResponse>("GET", "/api/coach/sessions");
  }

  /** GET /api/coach/goals?completed=true|false — list goals. */
  goals(opts: { completed?: boolean } = {}): Promise<CoachGoalsResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts.completed != null) {
      query.completed = opts.completed ? "true" : "false";
    }
    return this._root._request<CoachGoalsResponse>("GET", "/api/coach/goals", { query });
  }

  /** POST /api/coach/goals — create a new goal. */
  createGoal(input: CoachGoalCreateInput): Promise<CoachGoal> {
    if (!input || typeof input.title !== "string" || input.title.trim().length === 0) {
      throw new Error("Coach.createGoal missing title");
    }
    const body: CoachGoalCreateInput = { title: input.title };
    if (input.description !== undefined) body.description = input.description;
    if (input.dueDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}/.test(input.dueDate)) {
        throw new Error(
          `Coach.createGoal invalid dueDate '${input.dueDate}', expected ISO YYYY-MM-DD[...]`,
        );
      }
      body.dueDate = input.dueDate;
    }
    return this._root._request<CoachGoal>("POST", "/api/coach/goals", { body });
  }

  /** POST /api/coach/goals/:id/complete — mark a goal as completed. */
  completeGoal(goalId: string): Promise<CoachGoalCompleteResponse> {
    if (!goalId || !/^[a-z0-9-]+$/i.test(goalId)) {
      throw new Error(`Coach.completeGoal invalid goalId: '${goalId}'`);
    }
    return this._root._request<CoachGoalCompleteResponse>(
      "POST",
      `/api/coach/goals/${goalId}/complete`,
    );
  }
}

// ── Hub aggregate types (v0.3) ───────────────────────────────────────────────

export interface OpenApiModuleRef {
  name: string;
  title?: string;
  spec: string;
}

export interface OpenApiServiceRef {
  name: string;
  health: string;
}

export interface OpenApiSdkManifest {
  npm: string[];
  docs?: string;
}

export interface OpenApiIndex {
  name: string;
  version: string;
  description?: string;
  modules: OpenApiModuleRef[];
  services: OpenApiServiceRef[];
  sdk?: OpenApiSdkManifest;
  generatedAt: string;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const urlBlocks = xml.match(/<url\b[^>]*>[\s\S]*?<\/url>/g) ?? [];
  const pick = (block: string, tag: string): string | null => {
    const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? m[1].trim() : null;
  };
  for (const block of urlBlocks) {
    const loc = pick(block, "loc");
    if (!loc) continue;
    const priorityStr = pick(block, "priority");
    entries.push({
      loc,
      lastmod: pick(block, "lastmod"),
      changefreq: pick(block, "changefreq"),
      priority: priorityStr !== null && priorityStr !== "" ? Number(priorityStr) : null,
    });
  }
  return entries;
}

// ── Convenience function exports ────────────────────────────────────────────

const _default = new AevionCatalog();

/** Convenience: list modules using default client (api.aevion.app). */
export const listCatalog = (opts?: CatalogListOptions) => _default.list(opts);

/** Convenience: single-module lookup using default client. */
export const getModule = (id: string) => _default.get(id);

/** Convenience: registry stats using default client. */
export const getStats = () => _default.stats();

/** Convenience: aggregate health using default client. */
export const getHealth = () => _default.health();

/** Convenience: modules matching tag(s) using default client. */
export const searchByTag = (tag: string | string[]) => _default.searchByTag(tag);

/** Convenience: modules in given status(es) using default client. */
export const byStatus = (status: ModuleStatus | ModuleStatus[]) => _default.byStatus(status);

/** Convenience: modules of given kind(s) using default client. */
export const byKind = (kind: ModuleKind | ModuleKind[]) => _default.byKind(kind);

/** Convenience: MVPs + launched modules using default client. */
export const mvpsAndLaunched = () => _default.mvpsAndLaunched();

/** Convenience: top-N tags using default client. */
export const topTags = (n?: number) => _default.topTags(n);

/** Convenience: openapi aggregate index using default client. */
export const getOpenApi = () => _default.openapi();

/** Convenience: sitemap entries using default client. */
export const getSitemap = () => _default.sitemap();

/** Convenience: relatedModules for a module using default client (v0.4). */
export const getRelatedModules = (id: string) => _default.relatedModules(id);

/** Convenience: full tag-overlap graph using default client (v0.4). */
export const getGraph = (opts?: { topK?: number; minOverlap?: number }) => _default.graph(opts);

/** Convenience: single-source neighbours of a module using default client (v0.4). */
export const getNeighbours = (id: string, opts?: { topK?: number }) =>
  _default.neighbours(id, opts);

/** Convenience: text search using default client (v0.5). */
export const findByText = (query: string, opts?: { limit?: number }) =>
  _default.findByText(query, opts);

/** Convenience: pairwise module diff using default client (v0.5). */
export const diff = (idA: string, idB: string) => _default.diff(idA, idB);

/** Convenience: stable content fingerprint using default client (v0.5). */
export const fingerprintModule = (id: string) => _default.fingerprintModule(id);

/** Convenience: extended /stats snapshot using default client (v0.6). */
export const getExtendedStats = (opts?: { recent?: number }) =>
  _default.extendedStats(opts);

/** Convenience: deterministic module-of-the-day using default client (v0.6). */
export const getModuleOfTheDay = (opts?: { date?: string }) =>
  _default.moduleOfTheDay(opts);

// ── v0.6 convenience: QStore / QLearn / QEvents / DevHub / Planet ──────────

/** Convenience: QStore products listing. */
export const getQStoreProducts = (opts?: { sort?: QStoreSort }) =>
  _default.qstore.products(opts);

/** Convenience: QStore featured 4-bucket grid. */
export const getQStoreFeatured = (opts?: { limit?: number }) =>
  _default.qstore.featured(opts);

/** Convenience: add a QLearn course bookmark. */
export const bookmarkCourse = (courseId: string) => _default.qlearn.bookmark(courseId);

/** Convenience: remove a QLearn course bookmark. */
export const unbookmarkCourse = (courseId: string) => _default.qlearn.unbookmark(courseId);

/** Convenience: list current user's QLearn bookmarks. */
export const getMyBookmarks = () => _default.qlearn.bookmarks();

/** Convenience: current user's QLearn streak. */
export const getMyStreak = () => _default.qlearn.streak();

/** Convenience: current user's QLearn progress. */
export const getMyProgress = () => _default.qlearn.progress();

/** Convenience: QEvents listing. */
export const getEvents = (opts?: { when?: QEventsWhen }) => _default.qevents.list(opts);

/** Convenience: ICS payload for a single event. */
export const getEventIcs = (eventId: string) => _default.qevents.ics(eventId);

/** Convenience: DevHub snippets listing. */
export const getSnippets = (opts?: { limit?: number; tag?: string; user?: string }) =>
  _default.devhub.snippets(opts);

/** Convenience: create a DevHub snippet. */
export const createSnippet = (input: DevHubCreateSnippetInput) =>
  _default.devhub.createSnippet(input);

/** Convenience: fetch a DevHub snippet by id. */
export const getSnippet = (snippetId: string) => _default.devhub.getSnippet(snippetId);

/** Convenience: star a DevHub snippet. */
export const starSnippet = (snippetId: string) => _default.devhub.star(snippetId);

/** Convenience: Planet cross-module activity feed. */
export const getPlanetActivity = (opts?: {
  limit?: number;
  kinds?: PlanetActivityKind | PlanetActivityKind[];
}) => _default.planet.activity(opts);

// ── v0.7 convenience: QCoreAI / Multichat / QMedia / Coach ─────────────────

/** Convenience: QCoreAI providers listing. */
export const getQCoreAIProviders = () => _default.qcoreai.providers();

/** Convenience: QCoreAI per-provider health snapshot. */
export const getQCoreAIHealth = () => _default.qcoreai.health();

/** Convenience: QCoreAI chat completion. */
export const qcoreaiChat = (input: QCoreAIChatRequest) => _default.qcoreai.chat(input);

/** Convenience: Multichat presets listing. */
export const getMultichatPresets = () => _default.multichat.presets();

/** Convenience: Multichat provider-status. */
export const getMultichatProviderStatus = () => _default.multichat.providerStatus();

/** Convenience: launch a Multichat preset. */
export const launchMultichatPreset = (presetId: string) =>
  _default.multichat.launchPreset(presetId);

/** Convenience: QMedia personalised recommendations. */
export const getQMediaRecommendations = (opts?: { limit?: number }) =>
  _default.qmedia.recommendations(opts);

/** Convenience: QMedia trending tracks. */
export const getQMediaTrending = () => _default.qmedia.trending();

/** Convenience: QMedia full tracks listing. */
export const getQMediaTracks = () => _default.qmedia.tracks();

/** Convenience: current user's coach sessions. */
export const getMyCoachSessions = () => _default.coach.sessions();

/** Convenience: current user's coach goals. */
export const getMyCoachGoals = (opts?: { completed?: boolean }) =>
  _default.coach.goals(opts);

/** Convenience: create a new coach goal. */
export const createCoachGoal = (input: CoachGoalCreateInput) =>
  _default.coach.createGoal(input);

/** Convenience: mark a coach goal as completed. */
export const completeCoachGoal = (goalId: string) => _default.coach.completeGoal(goalId);

export default AevionCatalog;
