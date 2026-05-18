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
export type ModuleStatus = "launched" | "mvp" | "working" | "in_progress" | "research" | "planning" | "idea" | string;
export type ModuleKind = "product" | "service" | "experiment" | "core" | "infrastructure" | string;
export interface RelatedModule {
    id: string;
    name: string;
    overlap: number;
}
export interface GraphEdge {
    from: string;
    to: string;
    overlap: number;
    score: number;
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
    a: {
        id: string;
        name: string;
    };
    b: {
        id: string;
        name: string;
    };
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
    hash: string;
    length: number;
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
    byTag: {
        tag: string;
        count: number;
    }[];
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
    topTags: {
        tag: string;
        count: number;
    }[];
    coverage: {
        health: CoverageBucket;
        openapi: CoverageBucket;
    };
    recentActivity: ExtendedStatsRecentItem[];
    generatedAt: string;
}
export interface ModuleOfTheDay {
    date: string;
    dayOfYear: number;
    registrySize: number;
    module: CatalogItem;
    tomorrow: {
        id: string;
        code: string;
        name: string;
    };
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
    progress: number;
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
export type PlanetActivityKind = "module_update" | "release" | "post" | "comment" | "purchase" | "course_complete" | "event" | string;
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
    providers?: Record<string, {
        ok: boolean;
        status?: number;
        durationMs?: number;
    }>;
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
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
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
export interface QMediaVideo {
    id: string;
    userId?: string;
    title: string;
    description?: string | null;
    url?: string | null;
    thumbnailUrl?: string | null;
    duration?: number;
    viewCount?: number;
    isPublic?: boolean;
    category?: string;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}
export interface QMediaVideosResponse {
    total?: number;
    items: QMediaVideo[];
    [key: string]: unknown;
}
export interface QMediaPlayResult {
    ok?: boolean;
    /** Backend currently returns `playCount`; SDK aliases as `plays` for forward-compat. */
    playCount?: number;
    plays?: number;
    [key: string]: unknown;
}
export interface CoachSession {
    id: string;
    ownerKey?: string;
    title?: string;
    topic?: string;
    startingFen?: string;
    startedAt?: string;
    endedAt?: string | null;
    durationSec?: number;
    durationMin?: number;
    notes?: string;
    messageCount?: number;
    goalsLinked?: string[];
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
    /** Legacy v0.7 field. Server now returns `targetDate`. */
    dueDate?: string | null;
    /** v0.8: matches backend's `/api/coach/goals` (post-Bearer migration). */
    targetDate?: string | null;
    sessionId?: string | null;
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
/**
 * v0.7 input shape — kept for back-compat (`createGoal` accepts either).
 * Prefer `CoachGoalInput` for new code.
 * @deprecated since 0.8.0 — use `CoachGoalInput`.
 */
export interface CoachGoalCreateInput {
    title: string;
    description?: string;
    /** v0.7 field — backend now uses `targetDate`. SDK still forwards both for transition. */
    dueDate?: string;
}
/**
 * v0.8 input shape for `coach.createGoal`. Matches backend
 * `POST /api/coach/goals` after Bearer migration (block 7).
 */
export interface CoachGoalInput {
    title: string;
    description?: string;
    /** ISO 8601 (date or datetime). */
    targetDate?: string;
    /** Optional link to an existing coach session — must belong to caller. */
    sessionId?: string;
}
/**
 * v0.7 response shape — kept for back-compat (`completeGoal` may return either).
 * Prefer `{ goal }` (v0.8 backend shape) for new code.
 * @deprecated since 0.8.0 — backend now returns `{ goal }`.
 */
export interface CoachGoalCompleteResponse {
    ok: boolean;
    goalId: string;
    completed: boolean;
    completedAt?: string;
    [key: string]: unknown;
}
export interface CoachSessionStartInput {
    topic: string;
    /** Optional FEN string (≤120 chars) — chess starting position. */
    fen?: string;
}
export interface CoachSessionEndInput {
    notes?: string;
    messageCount?: number;
}
export declare class AevionCatalog {
    readonly baseUrl: string;
    private readonly _fetch;
    private readonly _defaultHeaders;
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
    /** QMedia (recommendations / trending / tracks / videos / play) sub-client (v0.7, extended in v0.8). */
    readonly qmedia: QMediaClient;
    /** Coach (sessions + goals — full mutation API) sub-client (v0.7, extended in v0.8). */
    readonly coach: CoachClient;
    constructor(config?: AevionCatalogConfig);
    /** @internal — used by sub-clients. */
    _request<T>(method: string, path: string, opts?: {
        query?: Record<string, string | number | undefined>;
        body?: unknown;
        accept?: string;
        asText?: boolean;
    }): Promise<T>;
    /** GET /api/aevion/catalog with optional filters + field projection. */
    list(opts?: CatalogListOptions): Promise<CatalogResponse>;
    /** GET /api/aevion/catalog/:id — single-module deep lookup. */
    get(moduleId: string): Promise<CatalogItem>;
    /** GET /api/aevion/registry-stats — taxonomy summary. */
    stats(): Promise<RegistryStats>;
    /** Returns the absolute URL for CSV export with given filters. */
    csvUrl(opts?: CatalogListOptions): string;
    /** Returns the absolute URL for markdown export with given filters. */
    markdownUrl(opts?: CatalogListOptions): string;
    /** Returns the shields.io-style SVG badge URL for given module id. */
    badgeUrl(moduleId: string): string;
    /** GET /api/aevion/health — aggregate health across all modules. */
    health(): Promise<{
        status: "ok" | "degraded" | "down";
        healthy: number;
        total: number;
        services: Record<string, {
            ok: boolean;
            status: number;
            durationMs: number;
        }>;
        timestamp: string;
    }>;
    /** Modules matching one or more tags (server-side filter, returns items only). */
    searchByTag(tag: string | string[]): Promise<CatalogItem[]>;
    /** Modules in the given status(es). */
    byStatus(status: ModuleStatus | ModuleStatus[]): Promise<CatalogItem[]>;
    /** Modules of the given kind(s). */
    byKind(kind: ModuleKind | ModuleKind[]): Promise<CatalogItem[]>;
    /** Sugar for `byStatus(["mvp", "launched"])` — everything that's live. */
    mvpsAndLaunched(): Promise<CatalogItem[]>;
    /** Top-N tags from registry stats (default 10). */
    topTags(n?: number): Promise<{
        tag: string;
        count: number;
    }[]>;
    /**
     * GET /api/aevion/stats — extended platform-wide statistics.
     *
     * Adds health/openapi coverage matrix, byPriority buckets and a
     * recentActivity feed on top of /registry-stats. Accepts a `recent`
     * size (clamped 1..50 server-side, default 10).
     */
    extendedStats(opts?: {
        recent?: number;
    }): Promise<ExtendedStats>;
    /**
     * GET /api/aevion/module-of-the-day — deterministic daily pick.
     *
     * Same module is returned for all consumers hitting the endpoint on the
     * same UTC day. Pass `date` (YYYY-MM-DD) to query a specific day, e.g.
     * for back-fill on archived posts.
     */
    moduleOfTheDay(opts?: {
        date?: string;
    }): Promise<ModuleOfTheDay>;
    /** Returns the relatedModules array for a single module (server-side computed). */
    relatedModules(id: string): Promise<RelatedModule[]>;
    /**
     * Build a full tag-overlap graph across the registry. Each item with its
     * top-K (default 5) related modules. Single round-trip via /catalog?fields=...
     * plus K-NN computed client-side using tag-Jaccard similarity.
     * Useful for visualisations or recommendation prototypes.
     */
    graph(opts?: {
        topK?: number;
        minOverlap?: number;
    }): Promise<GraphEdge[]>;
    /**
     * Find modules that share at least one tag with the given module's tags,
     * scored by Jaccard similarity. Single-source neighbour query.
     */
    neighbours(id: string, opts?: {
        topK?: number;
    }): Promise<NeighbourScore[]>;
    /**
     * Substring-search across module name + code + description + tags.
     * Returns matches sorted by simple relevance (matches in name > code > tags > description).
     * Single round-trip via fields projection.
     */
    findByText(query: string, opts?: {
        limit?: number;
    }): Promise<TextMatch[]>;
    /**
     * Pairwise diff of two modules: which fields agree / differ, plus
     * tag-overlap stats. Useful for "compare module A vs B" UIs.
     */
    diff(idA: string, idB: string): Promise<ModuleDiff>;
    /**
     * Stable content hash of a module's identity-defining fields. Useful
     * for cache busting / "did anything important change" checks.
     * Uses a tiny djb2-style hash — no crypto dependency.
     */
    fingerprintModule(id: string): Promise<ModuleFingerprint>;
    /** GET /api/aevion/openapi.json — aggregate API index (AEVION-shaped). */
    openapi(): Promise<OpenApiIndex>;
    /** GET /api/aevion/sitemap.xml — parsed to SitemapEntry[] via zero-dep regex. */
    sitemap(): Promise<SitemapEntry[]>;
}
/** QStore (marketplace) sub-client. Lazy — constructed by `AevionCatalog`. */
export declare class QStoreClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/qstore/products?sort=popular|newest|trending|rating */
    products(opts?: {
        sort?: QStoreSort;
    }): Promise<QStoreProductsResponse>;
    /** GET /api/qstore/featured?limit=N — 4 buckets (popular/trending/newest/topRated). */
    featured(opts?: {
        limit?: number;
    }): Promise<QStoreFeaturedResponse>;
}
/** QLearn (courses, bookmarks, streak, progress) sub-client. */
export declare class QLearnClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    private _assertCourseId;
    /** POST /api/qlearn/courses/:id/bookmark — add bookmark. */
    bookmark(courseId: string): Promise<QLearnBookmarkResult>;
    /** DELETE /api/qlearn/courses/:id/bookmark — remove bookmark. */
    unbookmark(courseId: string): Promise<QLearnBookmarkResult>;
    /** GET /api/qlearn/me/bookmarks — user's bookmarked courses. */
    bookmarks(): Promise<QLearnBookmarksResponse>;
    /** GET /api/qlearn/me/streak — learning streak summary. */
    streak(): Promise<QLearnStreak>;
    /** GET /api/qlearn/me/progress — full progress breakdown. */
    progress(): Promise<QLearnProgress>;
}
/** QEvents (event listing + ICS export) sub-client. */
export declare class QEventsClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/qevents/events?when=upcoming|past|all */
    list(opts?: {
        when?: QEventsWhen;
    }): Promise<QEventsListResponse>;
    /** GET /api/qevents/events/:id/ics — returns ICS text/calendar payload. */
    ics(eventId: string): Promise<string>;
    /** Returns the absolute ICS URL (no fetch). */
    icsUrl(eventId: string): string;
}
/** DevHub (snippets + stars) sub-client. */
export declare class DevHubClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/devhub/snippets?limit&tag&user — list snippets. */
    snippets(opts?: {
        limit?: number;
        tag?: string;
        user?: string;
    }): Promise<DevHubSnippetsResponse>;
    /** POST /api/devhub/snippets — create a new snippet. */
    createSnippet(input: DevHubCreateSnippetInput): Promise<DevHubSnippet>;
    /** GET /api/devhub/snippets/:id — fetch single snippet. */
    getSnippet(snippetId: string): Promise<DevHubSnippet>;
    /** POST /api/devhub/snippets/:id/star — toggle / increment star. */
    star(snippetId: string): Promise<DevHubStarResult>;
}
/** Planet (cross-module activity feed) sub-client. */
export declare class PlanetClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/planet/activity?limit&kinds — activity feed across all modules. */
    activity(opts?: {
        limit?: number;
        kinds?: PlanetActivityKind | PlanetActivityKind[];
    }): Promise<PlanetActivityResponse>;
}
/** QCoreAI (LLM providers + chat) sub-client. */
export declare class QCoreAIClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/qcoreai/providers — list available LLM providers. */
    providers(): Promise<QCoreAIProvidersResponse>;
    /** GET /api/qcoreai/health — per-provider health snapshot. */
    health(): Promise<QCoreAIHealthResponse>;
    /** POST /api/qcoreai/chat — single completion. */
    chat(input: QCoreAIChatRequest): Promise<QCoreAIChatResponse>;
}
/** Multichat (multi-provider presets + provider status) sub-client. */
export declare class MultichatClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/multichat/provider-status — health-style summary per provider. */
    providerStatus(): Promise<MultichatProviderStatus>;
    /** GET /api/multichat/presets — list available presets. */
    presets(): Promise<MultichatPresetsResponse>;
    /** POST /api/multichat/presets/:id/launch — launch a preset, returns session. */
    launchPreset(presetId: string): Promise<MultichatLaunchResponse>;
}
/** QMedia (recommendations / trending / tracks) sub-client. */
export declare class QMediaClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/qmedia/recommendations?limit=N — personalised picks. */
    recommendations(opts?: {
        limit?: number;
    }): Promise<QMediaRecommendationsResponse>;
    /** GET /api/qmedia/trending — currently-trending tracks. */
    trending(): Promise<QMediaTrendingResponse>;
    /**
     * GET /api/qmedia/tracks — public tracks listing (v0.8 adds optional filters).
     *
     * Backend clamps `limit` to 1..50. SDK mirrors that.
     * No args → identical to v0.7 behaviour.
     */
    tracks(opts?: {
        limit?: number;
        genre?: string;
        q?: string;
    }): Promise<QMediaTracksResponse>;
    /**
     * GET /api/qmedia/videos?limit=N&category=&q= — public videos listing (v0.8).
     *
     * Backend clamps `limit` to 1..50; SDK mirrors the clamp client-side.
     * `category` / `q` are server-side filters identical to /tracks.
     */
    videos(opts?: {
        limit?: number;
        offset?: number;
        category?: string;
        q?: string;
    }): Promise<QMediaVideosResponse>;
    /**
     * POST /api/qmedia/tracks/:id/play — record a play for a track (v0.8).
     *
     * Server returns `{ playCount }`; SDK normalises to `{ ok: true, plays }`
     * (also passes through original `playCount`) so callers can rely on a
     * consistent shape going forward.
     */
    recordPlay(trackId: string): Promise<QMediaPlayResult>;
}
/** Coach (sessions + goals) sub-client. */
export declare class CoachClient {
    private readonly _root;
    constructor(_root: AevionCatalog);
    /** GET /api/coach/sessions — current user's coach sessions. */
    sessions(): Promise<CoachSessionsResponse>;
    /** GET /api/coach/sessions/:id — single session detail. (v0.8) */
    getSession(sessionId: string): Promise<{
        session: CoachSession;
    }>;
    /**
     * POST /api/coach/sessions/start — start a coaching session. (v0.8)
     *
     * Body: `{ topic, fen? }`. Returns `{ session }`. SDK unwraps and returns
     * the bare `CoachSession` so call-sites stay flat.
     */
    startSession(input: CoachSessionStartInput): Promise<CoachSession>;
    /**
     * POST /api/coach/sessions/:id/end — end an active session. (v0.8)
     *
     * Body: `{ notes?, messageCount? }`. Returns `{ session }`. SDK unwraps.
     */
    endSession(sessionId: string, input?: CoachSessionEndInput): Promise<CoachSession>;
    /** GET /api/coach/goals?completed=true|false — list goals. */
    goals(opts?: {
        completed?: boolean;
    }): Promise<CoachGoalsResponse>;
    /**
     * POST /api/coach/goals — create a new goal.
     *
     * **Breaking change in v0.8:**
     *  - Input field renamed `dueDate` → `targetDate` (backend rename after Bearer
     *    migration in block 7). Legacy `dueDate` is still accepted on input and
     *    forwarded as `targetDate` for one-version transition; this fallback will
     *    be removed in v0.9.
     *  - Return type changed: `CoachGoal` → `{ goal: CoachGoal }`.
     *  - Adds optional `sessionId` to link a goal to an existing coach session.
     */
    createGoal(input: CoachGoalInput | CoachGoalCreateInput): Promise<{
        goal: CoachGoal;
    }>;
    /**
     * POST /api/coach/goals/:id/complete — mark a goal as completed.
     *
     * **Breaking change in v0.8:** return type changed from
     * `CoachGoalCompleteResponse` to `{ goal: CoachGoal }`. Idempotent.
     */
    completeGoal(goalId: string): Promise<{
        goal: CoachGoal;
    }>;
    /**
     * DELETE /api/coach/goals/:id — remove a goal. (v0.8)
     *
     * Backend returns 204 No Content; SDK normalises to `{ ok: true }`.
     */
    deleteGoal(goalId: string): Promise<{
        ok: boolean;
    }>;
}
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
/** Convenience: list modules using default client (api.aevion.app). */
export declare const listCatalog: (opts?: CatalogListOptions) => Promise<CatalogResponse>;
/** Convenience: single-module lookup using default client. */
export declare const getModule: (id: string) => Promise<CatalogItem>;
/** Convenience: registry stats using default client. */
export declare const getStats: () => Promise<RegistryStats>;
/** Convenience: aggregate health using default client. */
export declare const getHealth: () => Promise<{
    status: "ok" | "degraded" | "down";
    healthy: number;
    total: number;
    services: Record<string, {
        ok: boolean;
        status: number;
        durationMs: number;
    }>;
    timestamp: string;
}>;
/** Convenience: modules matching tag(s) using default client. */
export declare const searchByTag: (tag: string | string[]) => Promise<CatalogItem[]>;
/** Convenience: modules in given status(es) using default client. */
export declare const byStatus: (status: ModuleStatus | ModuleStatus[]) => Promise<CatalogItem[]>;
/** Convenience: modules of given kind(s) using default client. */
export declare const byKind: (kind: ModuleKind | ModuleKind[]) => Promise<CatalogItem[]>;
/** Convenience: MVPs + launched modules using default client. */
export declare const mvpsAndLaunched: () => Promise<CatalogItem[]>;
/** Convenience: top-N tags using default client. */
export declare const topTags: (n?: number) => Promise<{
    tag: string;
    count: number;
}[]>;
/** Convenience: openapi aggregate index using default client. */
export declare const getOpenApi: () => Promise<OpenApiIndex>;
/** Convenience: sitemap entries using default client. */
export declare const getSitemap: () => Promise<SitemapEntry[]>;
/** Convenience: relatedModules for a module using default client (v0.4). */
export declare const getRelatedModules: (id: string) => Promise<RelatedModule[]>;
/** Convenience: full tag-overlap graph using default client (v0.4). */
export declare const getGraph: (opts?: {
    topK?: number;
    minOverlap?: number;
}) => Promise<GraphEdge[]>;
/** Convenience: single-source neighbours of a module using default client (v0.4). */
export declare const getNeighbours: (id: string, opts?: {
    topK?: number;
}) => Promise<NeighbourScore[]>;
/** Convenience: text search using default client (v0.5). */
export declare const findByText: (query: string, opts?: {
    limit?: number;
}) => Promise<TextMatch[]>;
/** Convenience: pairwise module diff using default client (v0.5). */
export declare const diff: (idA: string, idB: string) => Promise<ModuleDiff>;
/** Convenience: stable content fingerprint using default client (v0.5). */
export declare const fingerprintModule: (id: string) => Promise<ModuleFingerprint>;
/** Convenience: extended /stats snapshot using default client (v0.6). */
export declare const getExtendedStats: (opts?: {
    recent?: number;
}) => Promise<ExtendedStats>;
/** Convenience: deterministic module-of-the-day using default client (v0.6). */
export declare const getModuleOfTheDay: (opts?: {
    date?: string;
}) => Promise<ModuleOfTheDay>;
/** Convenience: QStore products listing. */
export declare const getQStoreProducts: (opts?: {
    sort?: QStoreSort;
}) => Promise<QStoreProductsResponse>;
/** Convenience: QStore featured 4-bucket grid. */
export declare const getQStoreFeatured: (opts?: {
    limit?: number;
}) => Promise<QStoreFeaturedResponse>;
/** Convenience: add a QLearn course bookmark. */
export declare const bookmarkCourse: (courseId: string) => Promise<QLearnBookmarkResult>;
/** Convenience: remove a QLearn course bookmark. */
export declare const unbookmarkCourse: (courseId: string) => Promise<QLearnBookmarkResult>;
/** Convenience: list current user's QLearn bookmarks. */
export declare const getMyBookmarks: () => Promise<QLearnBookmarksResponse>;
/** Convenience: current user's QLearn streak. */
export declare const getMyStreak: () => Promise<QLearnStreak>;
/** Convenience: current user's QLearn progress. */
export declare const getMyProgress: () => Promise<QLearnProgress>;
/** Convenience: QEvents listing. */
export declare const getEvents: (opts?: {
    when?: QEventsWhen;
}) => Promise<QEventsListResponse>;
/** Convenience: ICS payload for a single event. */
export declare const getEventIcs: (eventId: string) => Promise<string>;
/** Convenience: DevHub snippets listing. */
export declare const getSnippets: (opts?: {
    limit?: number;
    tag?: string;
    user?: string;
}) => Promise<DevHubSnippetsResponse>;
/** Convenience: create a DevHub snippet. */
export declare const createSnippet: (input: DevHubCreateSnippetInput) => Promise<DevHubSnippet>;
/** Convenience: fetch a DevHub snippet by id. */
export declare const getSnippet: (snippetId: string) => Promise<DevHubSnippet>;
/** Convenience: star a DevHub snippet. */
export declare const starSnippet: (snippetId: string) => Promise<DevHubStarResult>;
/** Convenience: Planet cross-module activity feed. */
export declare const getPlanetActivity: (opts?: {
    limit?: number;
    kinds?: PlanetActivityKind | PlanetActivityKind[];
}) => Promise<PlanetActivityResponse>;
/** Convenience: QCoreAI providers listing. */
export declare const getQCoreAIProviders: () => Promise<QCoreAIProvidersResponse>;
/** Convenience: QCoreAI per-provider health snapshot. */
export declare const getQCoreAIHealth: () => Promise<QCoreAIHealthResponse>;
/** Convenience: QCoreAI chat completion. */
export declare const qcoreaiChat: (input: QCoreAIChatRequest) => Promise<QCoreAIChatResponse>;
/** Convenience: Multichat presets listing. */
export declare const getMultichatPresets: () => Promise<MultichatPresetsResponse>;
/** Convenience: Multichat provider-status. */
export declare const getMultichatProviderStatus: () => Promise<MultichatProviderStatus>;
/** Convenience: launch a Multichat preset. */
export declare const launchMultichatPreset: (presetId: string) => Promise<MultichatLaunchResponse>;
/** Convenience: QMedia personalised recommendations. */
export declare const getQMediaRecommendations: (opts?: {
    limit?: number;
}) => Promise<QMediaRecommendationsResponse>;
/** Convenience: QMedia trending tracks. */
export declare const getQMediaTrending: () => Promise<QMediaTrendingResponse>;
/** Convenience: QMedia full tracks listing. */
export declare const getQMediaTracks: () => Promise<QMediaTracksResponse>;
/** Convenience: QMedia public videos listing (v0.8). */
export declare const getQMediaVideos: (opts?: {
    limit?: number;
    offset?: number;
}) => Promise<QMediaVideosResponse>;
/** Convenience: record a play for a QMedia track (v0.8). */
export declare const recordQMediaPlay: (trackId: string) => Promise<QMediaPlayResult>;
/** Convenience: current user's coach sessions. */
export declare const getMyCoachSessions: () => Promise<CoachSessionsResponse>;
/** Convenience: single coach session detail (v0.8). */
export declare const getCoachSession: (sessionId: string) => Promise<{
    session: CoachSession;
}>;
/** Convenience: start a coach session (v0.8). */
export declare const startCoachSession: (input: CoachSessionStartInput) => Promise<CoachSession>;
/** Convenience: end a coach session (v0.8). */
export declare const endCoachSession: (sessionId: string, input?: CoachSessionEndInput) => Promise<CoachSession>;
/** Convenience: current user's coach goals. */
export declare const getMyCoachGoals: (opts?: {
    completed?: boolean;
}) => Promise<CoachGoalsResponse>;
/**
 * Convenience: create a new coach goal.
 *
 * **v0.8 breaking change:** returns `{ goal: CoachGoal }` (was `CoachGoal`)
 * and accepts `targetDate`/`sessionId`. Legacy `dueDate` still accepted on
 * input until v0.9.
 */
export declare const createCoachGoal: (input: CoachGoalInput | CoachGoalCreateInput) => Promise<{
    goal: CoachGoal;
}>;
/**
 * Convenience: mark a coach goal as completed.
 *
 * **v0.8 breaking change:** returns `{ goal: CoachGoal }` (was
 * `{ ok, goalId, completed, completedAt }`).
 */
export declare const completeCoachGoal: (goalId: string) => Promise<{
    goal: CoachGoal;
}>;
/** Convenience: delete a coach goal (v0.8). */
export declare const deleteCoachGoal: (goalId: string) => Promise<{
    ok: boolean;
}>;
export default AevionCatalog;
