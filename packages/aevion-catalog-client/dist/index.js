"use strict";
/**
 * @aevion-io/catalog-client — TypeScript client for the AEVION Hub catalog API.
 *
 * Zero dependencies. Uses global fetch (Node 18+ / all modern browsers).
 *
 * Usage:
 *   import { AevionCatalog } from "@aevion-io/catalog-client";
 *   const cat = new AevionCatalog();
 *   const all = await cat.list();
 *   const mvps = await cat.list({ status: "mvp" });
 *   const item = await cat.get("qpersona");
 *   const stats = await cat.stats();
 *   const csvUrl = cat.csvUrl({ status: "mvp" });
 *   const badgeUrl = cat.badgeUrl("qpersona");
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQMediaRecommendations = exports.launchMultichatPreset = exports.getMultichatProviderStatus = exports.getMultichatPresets = exports.qcoreaiChat = exports.getQCoreAIHealth = exports.getQCoreAIProviders = exports.getPlanetActivity = exports.starSnippet = exports.getSnippet = exports.createSnippet = exports.getSnippets = exports.getEventIcs = exports.getEvents = exports.getMyProgress = exports.getMyStreak = exports.getMyBookmarks = exports.unbookmarkCourse = exports.bookmarkCourse = exports.getQStoreFeatured = exports.getQStoreProducts = exports.getModuleOfTheDay = exports.getExtendedStats = exports.fingerprintModule = exports.diff = exports.findByText = exports.getNeighbours = exports.getGraph = exports.getRelatedModules = exports.getSitemap = exports.getOpenApi = exports.topTags = exports.mvpsAndLaunched = exports.byKind = exports.byStatus = exports.searchByTag = exports.getHealth = exports.getStats = exports.getModule = exports.listCatalog = exports.CoachClient = exports.QMediaClient = exports.MultichatClient = exports.QCoreAIClient = exports.PlanetClient = exports.DevHubClient = exports.QEventsClient = exports.QLearnClient = exports.QStoreClient = exports.AevionCatalog = void 0;
exports.deleteCoachGoal = exports.completeCoachGoal = exports.createCoachGoal = exports.getMyCoachGoals = exports.endCoachSession = exports.startCoachSession = exports.getCoachSession = exports.getMyCoachSessions = exports.recordQMediaPlay = exports.getQMediaVideos = exports.getQMediaTracks = exports.getQMediaTrending = void 0;
// ── Client ──────────────────────────────────────────────────────────────────
const DEFAULT_BASE = "https://api.aevion.app";
function joinCsv(v) {
    if (!v)
        return undefined;
    return Array.isArray(v) ? v.join(",") : v;
}
function buildQuery(opts, extra = {}) {
    const params = new URLSearchParams();
    const s = joinCsv(opts.status);
    const t = joinCsv(opts.tag);
    const k = joinCsv(opts.kind);
    if (s)
        params.set("status", s);
    if (t)
        params.set("tag", t);
    if (k)
        params.set("kind", k);
    if (opts.fields && opts.fields.length > 0)
        params.set("fields", opts.fields.join(","));
    for (const [key, val] of Object.entries(extra))
        params.set(key, val);
    const q = params.toString();
    return q ? `?${q}` : "";
}
class AevionCatalog {
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
        this._fetch =
            config.fetch ??
                (typeof fetch !== "undefined"
                    ? fetch.bind(globalThis)
                    : (() => {
                        throw new Error("global fetch is not available — pass `fetch` in config (e.g. node-fetch).");
                    }));
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
    _request(method, path, opts = {}) {
        const params = new URLSearchParams();
        if (opts.query) {
            for (const [k, v] of Object.entries(opts.query)) {
                if (v === undefined || v === null || v === "")
                    continue;
                params.set(k, String(v));
            }
        }
        const qs = params.toString();
        const url = `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}${qs ? `?${qs}` : ""}`;
        const headers = {
            ...this._defaultHeaders,
            Accept: opts.accept ?? "application/json",
        };
        const init = { method, headers };
        if (opts.body !== undefined) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(opts.body);
        }
        return this._fetch(url, init).then(async (r) => {
            if (!r.ok) {
                throw new Error(`AevionCatalog ${method} HTTP ${r.status} on ${url}`);
            }
            if (opts.asText)
                return (await r.text());
            // 204 No Content support
            if (r.status === 204)
                return undefined;
            return (await r.json());
        });
    }
    /** GET /api/aevion/catalog with optional filters + field projection. */
    async list(opts = {}) {
        const url = `${this.baseUrl}/api/aevion/catalog${buildQuery(opts)}`;
        const r = await this._fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok)
            throw new Error(`AevionCatalog.list HTTP ${r.status} on ${url}`);
        return (await r.json());
    }
    /** GET /api/aevion/catalog/:id — single-module deep lookup. */
    async get(moduleId) {
        if (!moduleId || !/^[a-z0-9-]+$/i.test(moduleId)) {
            throw new Error(`AevionCatalog.get invalid moduleId: '${moduleId}'`);
        }
        const url = `${this.baseUrl}/api/aevion/catalog/${moduleId}`;
        const r = await this._fetch(url, { headers: { Accept: "application/json" } });
        if (r.status === 404) {
            throw new Error(`AevionCatalog.get module not found: '${moduleId}'`);
        }
        if (!r.ok)
            throw new Error(`AevionCatalog.get HTTP ${r.status} on ${url}`);
        return (await r.json());
    }
    /** GET /api/aevion/registry-stats — taxonomy summary. */
    async stats() {
        const url = `${this.baseUrl}/api/aevion/registry-stats`;
        const r = await this._fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok)
            throw new Error(`AevionCatalog.stats HTTP ${r.status} on ${url}`);
        return (await r.json());
    }
    /** Returns the absolute URL for CSV export with given filters. */
    csvUrl(opts = {}) {
        return `${this.baseUrl}/api/aevion/catalog${buildQuery(opts, { format: "csv" })}`;
    }
    /** Returns the absolute URL for markdown export with given filters. */
    markdownUrl(opts = {}) {
        return `${this.baseUrl}/api/aevion/catalog${buildQuery(opts, { format: "md" })}`;
    }
    /** Returns the shields.io-style SVG badge URL for given module id. */
    badgeUrl(moduleId) {
        if (!/^[a-z0-9-]+$/i.test(moduleId)) {
            throw new Error(`AevionCatalog.badgeUrl invalid moduleId: '${moduleId}'`);
        }
        return `${this.baseUrl}/api/aevion/badges/${moduleId}.svg`;
    }
    /** GET /api/aevion/health — aggregate health across all modules. */
    async health() {
        const url = `${this.baseUrl}/api/aevion/health`;
        const r = await this._fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok)
            throw new Error(`AevionCatalog.health HTTP ${r.status} on ${url}`);
        return r.json();
    }
    // ── Helpers (v0.2) ────────────────────────────────────────────────────────
    /** Modules matching one or more tags (server-side filter, returns items only). */
    async searchByTag(tag) {
        const { items } = await this.list({ tag });
        return items;
    }
    /** Modules in the given status(es). */
    async byStatus(status) {
        const { items } = await this.list({ status });
        return items;
    }
    /** Modules of the given kind(s). */
    async byKind(kind) {
        const { items } = await this.list({ kind });
        return items;
    }
    /** Sugar for `byStatus(["mvp", "launched"])` — everything that's live. */
    async mvpsAndLaunched() {
        return this.byStatus(["mvp", "launched"]);
    }
    /** Top-N tags from registry stats (default 10). */
    async topTags(n = 10) {
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
    async extendedStats(opts = {}) {
        const params = new URLSearchParams();
        if (opts.recent != null) {
            const n = Math.max(1, Math.min(50, Math.floor(opts.recent)));
            params.set("recent", String(n));
        }
        const qs = params.toString();
        const url = `${this.baseUrl}/api/aevion/stats${qs ? `?${qs}` : ""}`;
        const r = await this._fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok)
            throw new Error(`AevionCatalog.extendedStats HTTP ${r.status} on ${url}`);
        return (await r.json());
    }
    /**
     * GET /api/aevion/module-of-the-day — deterministic daily pick.
     *
     * Same module is returned for all consumers hitting the endpoint on the
     * same UTC day. Pass `date` (YYYY-MM-DD) to query a specific day, e.g.
     * for back-fill on archived posts.
     */
    async moduleOfTheDay(opts = {}) {
        const params = new URLSearchParams();
        if (opts.date) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
                throw new Error(`AevionCatalog.moduleOfTheDay invalid date '${opts.date}', expected YYYY-MM-DD`);
            }
            params.set("date", opts.date);
        }
        const qs = params.toString();
        const url = `${this.baseUrl}/api/aevion/module-of-the-day${qs ? `?${qs}` : ""}`;
        const r = await this._fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok)
            throw new Error(`AevionCatalog.moduleOfTheDay HTTP ${r.status} on ${url}`);
        return (await r.json());
    }
    // ── Graph helpers (v0.4) ───────────────────────────────────────────────────
    /** Returns the relatedModules array for a single module (server-side computed). */
    async relatedModules(id) {
        const m = await this.get(id);
        return m.relatedModules ?? [];
    }
    /**
     * Build a full tag-overlap graph across the registry. Each item with its
     * top-K (default 5) related modules. Single round-trip via /catalog?fields=...
     * plus K-NN computed client-side using tag-Jaccard similarity.
     * Useful for visualisations or recommendation prototypes.
     */
    async graph(opts = {}) {
        const topK = opts.topK ?? 5;
        const minOverlap = opts.minOverlap ?? 0;
        const { items } = await this.list({ fields: ["id", "name", "tags"] });
        const edges = [];
        for (const a of items) {
            const aTags = new Set(a.tags ?? []);
            if (aTags.size === 0)
                continue;
            const candidates = [];
            for (const b of items) {
                if (b.id === a.id)
                    continue;
                const bTags = b.tags ?? [];
                let overlap = 0;
                for (const t of bTags)
                    if (aTags.has(t))
                        overlap++;
                if (overlap <= minOverlap)
                    continue;
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
    async neighbours(id, opts = {}) {
        const topK = opts.topK ?? 10;
        const me = await this.get(id);
        const myTags = new Set(me.tags ?? []);
        if (myTags.size === 0)
            return [];
        const { items } = await this.list({ fields: ["id", "name", "status", "tags"] });
        const scored = [];
        for (const b of items) {
            if (b.id === id)
                continue;
            const bTags = b.tags ?? [];
            let overlap = 0;
            for (const t of bTags)
                if (myTags.has(t))
                    overlap++;
            if (overlap === 0)
                continue;
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
    async findByText(query, opts = {}) {
        const limit = opts.limit ?? 20;
        const q = query.trim().toLowerCase();
        if (q.length < 2)
            return [];
        const { items } = await this.list({
            fields: ["id", "code", "name", "description", "status", "tags"],
        });
        const matches = [];
        for (const m of items) {
            const name = (m.name ?? "").toLowerCase();
            const code = (m.code ?? "").toLowerCase();
            const tagsHit = (m.tags ?? []).some((t) => t.toLowerCase().includes(q));
            const descHit = (m.description ?? "").toLowerCase().includes(q);
            let score = 0;
            if (name.includes(q))
                score += name === q ? 100 : name.startsWith(q) ? 50 : 30;
            if (code.includes(q))
                score += code === q ? 80 : 25;
            if (tagsHit)
                score += 15;
            if (descHit)
                score += 5;
            if (score > 0)
                matches.push({ id: m.id, name: m.name, code: m.code, status: m.status, score });
        }
        matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        return matches.slice(0, limit);
    }
    /**
     * Pairwise diff of two modules: which fields agree / differ, plus
     * tag-overlap stats. Useful for "compare module A vs B" UIs.
     */
    async diff(idA, idB) {
        const [a, b] = await Promise.all([this.get(idA), this.get(idB)]);
        const aTags = new Set(a.tags ?? []);
        const bTags = new Set(b.tags ?? []);
        const shared = [...aTags].filter((t) => bTags.has(t));
        const onlyA = [...aTags].filter((t) => !bTags.has(t));
        const onlyB = [...bTags].filter((t) => !aTags.has(t));
        const fields = [];
        const keys = ["status", "kind", "priority"];
        for (const k of keys) {
            fields.push({ key: k, a: a[k], b: b[k], equal: a[k] === b[k] });
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
    async fingerprintModule(id) {
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
    async openapi() {
        const url = `${this.baseUrl}/api/aevion/openapi.json`;
        const r = await this._fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok)
            throw new Error(`AevionCatalog.openapi HTTP ${r.status} on ${url}`);
        const j = (await r.json());
        const a = j.aevion ?? {};
        return {
            name: a.name ?? "AEVION API Index",
            version: a.version ?? "0.0.0",
            description: a.description,
            modules: Array.isArray(a.modules) ? a.modules : [],
            services: Array.isArray(a.services) ? a.services : [],
            sdk: a.sdk,
            generatedAt: a.generatedAt ?? new Date().toISOString(),
        };
    }
    /** GET /api/aevion/sitemap.xml — parsed to SitemapEntry[] via zero-dep regex. */
    async sitemap() {
        const url = `${this.baseUrl}/api/aevion/sitemap.xml`;
        const r = await this._fetch(url, { headers: { Accept: "application/xml,text/xml" } });
        if (!r.ok)
            throw new Error(`AevionCatalog.sitemap HTTP ${r.status} on ${url}`);
        const text = await r.text();
        return parseSitemap(text);
    }
}
exports.AevionCatalog = AevionCatalog;
// ── v0.6 sub-clients: QStore / QLearn / QEvents / DevHub / Planet ───────────
/** QStore (marketplace) sub-client. Lazy — constructed by `AevionCatalog`. */
class QStoreClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/qstore/products?sort=popular|newest|trending|rating */
    products(opts = {}) {
        const sort = opts.sort;
        if (sort && !["popular", "newest", "trending", "rating"].includes(sort)) {
            throw new Error(`QStore.products invalid sort: '${sort}'`);
        }
        return this._root._request("GET", "/api/qstore/products", {
            query: { sort },
        });
    }
    /** GET /api/qstore/featured?limit=N — 4 buckets (popular/trending/newest/topRated). */
    featured(opts = {}) {
        const query = {};
        if (opts.limit != null) {
            const n = Math.max(1, Math.min(50, Math.floor(opts.limit)));
            query.limit = n;
        }
        return this._root._request("GET", "/api/qstore/featured", { query });
    }
}
exports.QStoreClient = QStoreClient;
/** QLearn (courses, bookmarks, streak, progress) sub-client. */
class QLearnClient {
    constructor(_root) {
        this._root = _root;
    }
    _assertCourseId(id) {
        if (!id || !/^[a-z0-9-]+$/i.test(id)) {
            throw new Error(`QLearn invalid courseId: '${id}'`);
        }
    }
    /** POST /api/qlearn/courses/:id/bookmark — add bookmark. */
    async bookmark(courseId) {
        this._assertCourseId(courseId);
        return this._root._request("POST", `/api/qlearn/courses/${courseId}/bookmark`);
    }
    /** DELETE /api/qlearn/courses/:id/bookmark — remove bookmark. */
    unbookmark(courseId) {
        this._assertCourseId(courseId);
        return this._root._request("DELETE", `/api/qlearn/courses/${courseId}/bookmark`);
    }
    /** GET /api/qlearn/me/bookmarks — user's bookmarked courses. */
    bookmarks() {
        return this._root._request("GET", "/api/qlearn/me/bookmarks");
    }
    /** GET /api/qlearn/me/streak — learning streak summary. */
    streak() {
        return this._root._request("GET", "/api/qlearn/me/streak");
    }
    /** GET /api/qlearn/me/progress — full progress breakdown. */
    progress() {
        return this._root._request("GET", "/api/qlearn/me/progress");
    }
}
exports.QLearnClient = QLearnClient;
/** QEvents (event listing + ICS export) sub-client. */
class QEventsClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/qevents/events?when=upcoming|past|all */
    list(opts = {}) {
        const when = opts.when;
        if (when && !["upcoming", "past", "all"].includes(when)) {
            throw new Error(`QEvents.list invalid when: '${when}'`);
        }
        return this._root._request("GET", "/api/qevents/events", {
            query: { when },
        });
    }
    /** GET /api/qevents/events/:id/ics — returns ICS text/calendar payload. */
    async ics(eventId) {
        if (!eventId || !/^[a-z0-9-]+$/i.test(eventId)) {
            throw new Error(`QEvents.ics invalid eventId: '${eventId}'`);
        }
        return this._root._request("GET", `/api/qevents/events/${eventId}/ics`, {
            accept: "text/calendar",
            asText: true,
        });
    }
    /** Returns the absolute ICS URL (no fetch). */
    icsUrl(eventId) {
        if (!/^[a-z0-9-]+$/i.test(eventId)) {
            throw new Error(`QEvents.icsUrl invalid eventId: '${eventId}'`);
        }
        return `${this._root.baseUrl}/api/qevents/events/${eventId}/ics`;
    }
}
exports.QEventsClient = QEventsClient;
/** DevHub (snippets + stars) sub-client. */
class DevHubClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/devhub/snippets?limit&tag&user — list snippets. */
    snippets(opts = {}) {
        const query = {};
        if (opts.limit != null) {
            const n = Math.max(1, Math.min(200, Math.floor(opts.limit)));
            query.limit = n;
        }
        if (opts.tag)
            query.tag = opts.tag;
        if (opts.user)
            query.user = opts.user;
        return this._root._request("GET", "/api/devhub/snippets", { query });
    }
    /** POST /api/devhub/snippets — create a new snippet. */
    createSnippet(input) {
        if (!input || typeof input.title !== "string" || input.title.trim().length === 0) {
            throw new Error(`DevHub.createSnippet missing title`);
        }
        if (typeof input.content !== "string" || input.content.length === 0) {
            throw new Error(`DevHub.createSnippet missing content`);
        }
        if (typeof input.language !== "string" || input.language.trim().length === 0) {
            throw new Error(`DevHub.createSnippet missing language`);
        }
        const body = {
            title: input.title,
            content: input.content,
            language: input.language,
            tags: Array.isArray(input.tags) ? input.tags : [],
        };
        return this._root._request("POST", "/api/devhub/snippets", { body });
    }
    /** GET /api/devhub/snippets/:id — fetch single snippet. */
    getSnippet(snippetId) {
        if (!snippetId || !/^[a-z0-9-]+$/i.test(snippetId)) {
            throw new Error(`DevHub.getSnippet invalid snippetId: '${snippetId}'`);
        }
        return this._root._request("GET", `/api/devhub/snippets/${snippetId}`);
    }
    /** POST /api/devhub/snippets/:id/star — toggle / increment star. */
    async star(snippetId) {
        if (!snippetId || !/^[a-z0-9-]+$/i.test(snippetId)) {
            throw new Error(`DevHub.star invalid snippetId: '${snippetId}'`);
        }
        return this._root._request("POST", `/api/devhub/snippets/${snippetId}/star`);
    }
}
exports.DevHubClient = DevHubClient;
/** Planet (cross-module activity feed) sub-client. */
class PlanetClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/planet/activity?limit&kinds — activity feed across all modules. */
    activity(opts = {}) {
        const query = {};
        if (opts.limit != null) {
            const n = Math.max(1, Math.min(200, Math.floor(opts.limit)));
            query.limit = n;
        }
        if (opts.kinds) {
            query.kinds = Array.isArray(opts.kinds) ? opts.kinds.join(",") : String(opts.kinds);
        }
        return this._root._request("GET", "/api/planet/activity", { query });
    }
}
exports.PlanetClient = PlanetClient;
// ── v0.7 sub-clients: QCoreAI / Multichat / QMedia / Coach ──────────────────
/** QCoreAI (LLM providers + chat) sub-client. */
class QCoreAIClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/qcoreai/providers — list available LLM providers. */
    providers() {
        return this._root._request("GET", "/api/qcoreai/providers");
    }
    /** GET /api/qcoreai/health — per-provider health snapshot. */
    health() {
        return this._root._request("GET", "/api/qcoreai/health");
    }
    /** POST /api/qcoreai/chat — single completion. */
    chat(input) {
        if (!input || !Array.isArray(input.messages) || input.messages.length === 0) {
            throw new Error("QCoreAI.chat missing messages[]");
        }
        return this._root._request("POST", "/api/qcoreai/chat", {
            body: input,
        });
    }
}
exports.QCoreAIClient = QCoreAIClient;
/** Multichat (multi-provider presets + provider status) sub-client. */
class MultichatClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/multichat/provider-status — health-style summary per provider. */
    providerStatus() {
        return this._root._request("GET", "/api/multichat/provider-status");
    }
    /** GET /api/multichat/presets — list available presets. */
    presets() {
        return this._root._request("GET", "/api/multichat/presets");
    }
    /** POST /api/multichat/presets/:id/launch — launch a preset, returns session. */
    async launchPreset(presetId) {
        if (!presetId || !/^[a-z0-9-]+$/i.test(presetId)) {
            throw new Error(`Multichat.launchPreset invalid presetId: '${presetId}'`);
        }
        return this._root._request("POST", `/api/multichat/presets/${presetId}/launch`);
    }
}
exports.MultichatClient = MultichatClient;
/** QMedia (recommendations / trending / tracks) sub-client. */
class QMediaClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/qmedia/recommendations?limit=N — personalised picks. */
    recommendations(opts = {}) {
        const query = {};
        if (opts.limit != null) {
            const n = Math.max(1, Math.min(100, Math.floor(opts.limit)));
            query.limit = n;
        }
        return this._root._request("GET", "/api/qmedia/recommendations", { query });
    }
    /** GET /api/qmedia/trending — currently-trending tracks. */
    trending() {
        return this._root._request("GET", "/api/qmedia/trending");
    }
    /**
     * GET /api/qmedia/tracks — public tracks listing (v0.8 adds optional filters).
     *
     * Backend clamps `limit` to 1..50. SDK mirrors that.
     * No args → identical to v0.7 behaviour.
     */
    tracks(opts = {}) {
        const query = {};
        if (opts.limit != null) {
            const n = Math.max(1, Math.min(50, Math.floor(opts.limit)));
            query.limit = n;
        }
        if (opts.genre)
            query.genre = opts.genre;
        if (opts.q)
            query.q = opts.q;
        return this._root._request("GET", "/api/qmedia/tracks", { query });
    }
    /**
     * GET /api/qmedia/videos?limit=N&category=&q= — public videos listing (v0.8).
     *
     * Backend clamps `limit` to 1..50; SDK mirrors the clamp client-side.
     * `category` / `q` are server-side filters identical to /tracks.
     */
    videos(opts = {}) {
        const query = {};
        if (opts.limit != null) {
            const n = Math.max(1, Math.min(50, Math.floor(opts.limit)));
            query.limit = n;
        }
        if (opts.offset != null) {
            const n = Math.max(0, Math.floor(opts.offset));
            query.offset = n;
        }
        if (opts.category)
            query.category = opts.category;
        if (opts.q)
            query.q = opts.q;
        return this._root._request("GET", "/api/qmedia/videos", { query });
    }
    /**
     * POST /api/qmedia/tracks/:id/play — record a play for a track (v0.8).
     *
     * Server returns `{ playCount }`; SDK normalises to `{ ok: true, plays }`
     * (also passes through original `playCount`) so callers can rely on a
     * consistent shape going forward.
     */
    async recordPlay(trackId) {
        if (!trackId || !/^[a-z0-9-]+$/i.test(trackId)) {
            throw new Error(`QMedia.recordPlay invalid trackId: '${trackId}'`);
        }
        const raw = await this._root._request("POST", `/api/qmedia/tracks/${trackId}/play`);
        const plays = typeof raw?.plays === "number"
            ? raw.plays
            : typeof raw?.playCount === "number"
                ? raw.playCount
                : undefined;
        return {
            ok: true,
            ...raw,
            ...(plays != null ? { plays, playCount: plays } : {}),
        };
    }
}
exports.QMediaClient = QMediaClient;
/** Coach (sessions + goals) sub-client. */
class CoachClient {
    constructor(_root) {
        this._root = _root;
    }
    /** GET /api/coach/sessions — current user's coach sessions. */
    sessions() {
        return this._root._request("GET", "/api/coach/sessions");
    }
    /** GET /api/coach/sessions/:id — single session detail. (v0.8) */
    getSession(sessionId) {
        if (!sessionId || sessionId.trim().length === 0) {
            throw new Error(`Coach.getSession missing sessionId`);
        }
        return this._root._request("GET", `/api/coach/sessions/${encodeURIComponent(sessionId)}`);
    }
    /**
     * POST /api/coach/sessions/start — start a coaching session. (v0.8)
     *
     * Body: `{ topic, fen? }`. Returns `{ session }`. SDK unwraps and returns
     * the bare `CoachSession` so call-sites stay flat.
     */
    async startSession(input) {
        if (!input || typeof input.topic !== "string" || input.topic.trim().length === 0) {
            throw new Error("Coach.startSession missing topic");
        }
        const body = { topic: input.topic.trim() };
        if (input.fen !== undefined) {
            if (typeof input.fen !== "string" || input.fen.length > 120) {
                throw new Error(`Coach.startSession invalid fen (must be string ≤120 chars)`);
            }
            body.startingFen = input.fen.trim();
        }
        const r = await this._root._request("POST", "/api/coach/sessions/start", { body });
        return r.session;
    }
    /**
     * POST /api/coach/sessions/:id/end — end an active session. (v0.8)
     *
     * Body: `{ notes?, messageCount? }`. Returns `{ session }`. SDK unwraps.
     */
    async endSession(sessionId, input = {}) {
        if (!sessionId || sessionId.trim().length === 0) {
            throw new Error("Coach.endSession missing sessionId");
        }
        const body = {};
        if (input.notes !== undefined) {
            if (typeof input.notes !== "string") {
                throw new Error("Coach.endSession notes must be a string");
            }
            body.notes = input.notes;
        }
        if (input.messageCount !== undefined) {
            if (typeof input.messageCount !== "number" || !Number.isFinite(input.messageCount) || input.messageCount < 0) {
                throw new Error("Coach.endSession messageCount must be a non-negative number");
            }
            body.messageCount = Math.floor(input.messageCount);
        }
        const r = await this._root._request("POST", `/api/coach/sessions/${encodeURIComponent(sessionId)}/end`, { body });
        return r.session;
    }
    /** GET /api/coach/goals?completed=true|false — list goals. */
    goals(opts = {}) {
        const query = {};
        if (opts.completed != null) {
            query.completed = opts.completed ? "true" : "false";
        }
        return this._root._request("GET", "/api/coach/goals", { query });
    }
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
    createGoal(input) {
        if (!input || typeof input.title !== "string" || input.title.trim().length === 0) {
            throw new Error("Coach.createGoal missing title");
        }
        const body = {
            title: input.title.trim(),
        };
        if (input.description !== undefined)
            body.description = input.description;
        // Prefer v0.8 `targetDate`, fall back to v0.7 `dueDate`.
        const target = "targetDate" in input && input.targetDate !== undefined
            ? input.targetDate
            : "dueDate" in input && input.dueDate !== undefined
                ? input.dueDate
                : undefined;
        if (target !== undefined) {
            if (typeof target !== "string" || Number.isNaN(Date.parse(target))) {
                throw new Error(`Coach.createGoal invalid targetDate '${target}', expected ISO 8601`);
            }
            body.targetDate = target;
        }
        if ("sessionId" in input && input.sessionId !== undefined) {
            if (typeof input.sessionId !== "string" || input.sessionId.trim().length === 0) {
                throw new Error(`Coach.createGoal invalid sessionId`);
            }
            body.sessionId = input.sessionId;
        }
        return this._root._request("POST", "/api/coach/goals", { body });
    }
    /**
     * POST /api/coach/goals/:id/complete — mark a goal as completed.
     *
     * **Breaking change in v0.8:** return type changed from
     * `CoachGoalCompleteResponse` to `{ goal: CoachGoal }`. Idempotent.
     */
    async completeGoal(goalId) {
        if (!goalId || goalId.trim().length === 0) {
            throw new Error(`Coach.completeGoal missing goalId`);
        }
        return this._root._request("POST", `/api/coach/goals/${encodeURIComponent(goalId)}/complete`);
    }
    /**
     * DELETE /api/coach/goals/:id — remove a goal. (v0.8)
     *
     * Backend returns 204 No Content; SDK normalises to `{ ok: true }`.
     */
    async deleteGoal(goalId) {
        if (!goalId || goalId.trim().length === 0) {
            throw new Error(`Coach.deleteGoal missing goalId`);
        }
        await this._root._request("DELETE", `/api/coach/goals/${encodeURIComponent(goalId)}`);
        return { ok: true };
    }
}
exports.CoachClient = CoachClient;
function djb2(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, "0");
}
function parseSitemap(xml) {
    const entries = [];
    const urlBlocks = xml.match(/<url\b[^>]*>[\s\S]*?<\/url>/g) ?? [];
    const pick = (block, tag) => {
        const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
        return m ? m[1].trim() : null;
    };
    for (const block of urlBlocks) {
        const loc = pick(block, "loc");
        if (!loc)
            continue;
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
const listCatalog = (opts) => _default.list(opts);
exports.listCatalog = listCatalog;
/** Convenience: single-module lookup using default client. */
const getModule = (id) => _default.get(id);
exports.getModule = getModule;
/** Convenience: registry stats using default client. */
const getStats = () => _default.stats();
exports.getStats = getStats;
/** Convenience: aggregate health using default client. */
const getHealth = () => _default.health();
exports.getHealth = getHealth;
/** Convenience: modules matching tag(s) using default client. */
const searchByTag = (tag) => _default.searchByTag(tag);
exports.searchByTag = searchByTag;
/** Convenience: modules in given status(es) using default client. */
const byStatus = (status) => _default.byStatus(status);
exports.byStatus = byStatus;
/** Convenience: modules of given kind(s) using default client. */
const byKind = (kind) => _default.byKind(kind);
exports.byKind = byKind;
/** Convenience: MVPs + launched modules using default client. */
const mvpsAndLaunched = () => _default.mvpsAndLaunched();
exports.mvpsAndLaunched = mvpsAndLaunched;
/** Convenience: top-N tags using default client. */
const topTags = (n) => _default.topTags(n);
exports.topTags = topTags;
/** Convenience: openapi aggregate index using default client. */
const getOpenApi = () => _default.openapi();
exports.getOpenApi = getOpenApi;
/** Convenience: sitemap entries using default client. */
const getSitemap = () => _default.sitemap();
exports.getSitemap = getSitemap;
/** Convenience: relatedModules for a module using default client (v0.4). */
const getRelatedModules = (id) => _default.relatedModules(id);
exports.getRelatedModules = getRelatedModules;
/** Convenience: full tag-overlap graph using default client (v0.4). */
const getGraph = (opts) => _default.graph(opts);
exports.getGraph = getGraph;
/** Convenience: single-source neighbours of a module using default client (v0.4). */
const getNeighbours = (id, opts) => _default.neighbours(id, opts);
exports.getNeighbours = getNeighbours;
/** Convenience: text search using default client (v0.5). */
const findByText = (query, opts) => _default.findByText(query, opts);
exports.findByText = findByText;
/** Convenience: pairwise module diff using default client (v0.5). */
const diff = (idA, idB) => _default.diff(idA, idB);
exports.diff = diff;
/** Convenience: stable content fingerprint using default client (v0.5). */
const fingerprintModule = (id) => _default.fingerprintModule(id);
exports.fingerprintModule = fingerprintModule;
/** Convenience: extended /stats snapshot using default client (v0.6). */
const getExtendedStats = (opts) => _default.extendedStats(opts);
exports.getExtendedStats = getExtendedStats;
/** Convenience: deterministic module-of-the-day using default client (v0.6). */
const getModuleOfTheDay = (opts) => _default.moduleOfTheDay(opts);
exports.getModuleOfTheDay = getModuleOfTheDay;
// ── v0.6 convenience: QStore / QLearn / QEvents / DevHub / Planet ──────────
/** Convenience: QStore products listing. */
const getQStoreProducts = (opts) => _default.qstore.products(opts);
exports.getQStoreProducts = getQStoreProducts;
/** Convenience: QStore featured 4-bucket grid. */
const getQStoreFeatured = (opts) => _default.qstore.featured(opts);
exports.getQStoreFeatured = getQStoreFeatured;
/** Convenience: add a QLearn course bookmark. */
const bookmarkCourse = (courseId) => _default.qlearn.bookmark(courseId);
exports.bookmarkCourse = bookmarkCourse;
/** Convenience: remove a QLearn course bookmark. */
const unbookmarkCourse = (courseId) => _default.qlearn.unbookmark(courseId);
exports.unbookmarkCourse = unbookmarkCourse;
/** Convenience: list current user's QLearn bookmarks. */
const getMyBookmarks = () => _default.qlearn.bookmarks();
exports.getMyBookmarks = getMyBookmarks;
/** Convenience: current user's QLearn streak. */
const getMyStreak = () => _default.qlearn.streak();
exports.getMyStreak = getMyStreak;
/** Convenience: current user's QLearn progress. */
const getMyProgress = () => _default.qlearn.progress();
exports.getMyProgress = getMyProgress;
/** Convenience: QEvents listing. */
const getEvents = (opts) => _default.qevents.list(opts);
exports.getEvents = getEvents;
/** Convenience: ICS payload for a single event. */
const getEventIcs = (eventId) => _default.qevents.ics(eventId);
exports.getEventIcs = getEventIcs;
/** Convenience: DevHub snippets listing. */
const getSnippets = (opts) => _default.devhub.snippets(opts);
exports.getSnippets = getSnippets;
/** Convenience: create a DevHub snippet. */
const createSnippet = (input) => _default.devhub.createSnippet(input);
exports.createSnippet = createSnippet;
/** Convenience: fetch a DevHub snippet by id. */
const getSnippet = (snippetId) => _default.devhub.getSnippet(snippetId);
exports.getSnippet = getSnippet;
/** Convenience: star a DevHub snippet. */
const starSnippet = (snippetId) => _default.devhub.star(snippetId);
exports.starSnippet = starSnippet;
/** Convenience: Planet cross-module activity feed. */
const getPlanetActivity = (opts) => _default.planet.activity(opts);
exports.getPlanetActivity = getPlanetActivity;
// ── v0.7 convenience: QCoreAI / Multichat / QMedia / Coach ─────────────────
/** Convenience: QCoreAI providers listing. */
const getQCoreAIProviders = () => _default.qcoreai.providers();
exports.getQCoreAIProviders = getQCoreAIProviders;
/** Convenience: QCoreAI per-provider health snapshot. */
const getQCoreAIHealth = () => _default.qcoreai.health();
exports.getQCoreAIHealth = getQCoreAIHealth;
/** Convenience: QCoreAI chat completion. */
const qcoreaiChat = (input) => _default.qcoreai.chat(input);
exports.qcoreaiChat = qcoreaiChat;
/** Convenience: Multichat presets listing. */
const getMultichatPresets = () => _default.multichat.presets();
exports.getMultichatPresets = getMultichatPresets;
/** Convenience: Multichat provider-status. */
const getMultichatProviderStatus = () => _default.multichat.providerStatus();
exports.getMultichatProviderStatus = getMultichatProviderStatus;
/** Convenience: launch a Multichat preset. */
const launchMultichatPreset = (presetId) => _default.multichat.launchPreset(presetId);
exports.launchMultichatPreset = launchMultichatPreset;
/** Convenience: QMedia personalised recommendations. */
const getQMediaRecommendations = (opts) => _default.qmedia.recommendations(opts);
exports.getQMediaRecommendations = getQMediaRecommendations;
/** Convenience: QMedia trending tracks. */
const getQMediaTrending = () => _default.qmedia.trending();
exports.getQMediaTrending = getQMediaTrending;
/** Convenience: QMedia full tracks listing. */
const getQMediaTracks = () => _default.qmedia.tracks();
exports.getQMediaTracks = getQMediaTracks;
/** Convenience: QMedia public videos listing (v0.8). */
const getQMediaVideos = (opts) => _default.qmedia.videos(opts);
exports.getQMediaVideos = getQMediaVideos;
/** Convenience: record a play for a QMedia track (v0.8). */
const recordQMediaPlay = (trackId) => _default.qmedia.recordPlay(trackId);
exports.recordQMediaPlay = recordQMediaPlay;
/** Convenience: current user's coach sessions. */
const getMyCoachSessions = () => _default.coach.sessions();
exports.getMyCoachSessions = getMyCoachSessions;
/** Convenience: single coach session detail (v0.8). */
const getCoachSession = (sessionId) => _default.coach.getSession(sessionId);
exports.getCoachSession = getCoachSession;
/** Convenience: start a coach session (v0.8). */
const startCoachSession = (input) => _default.coach.startSession(input);
exports.startCoachSession = startCoachSession;
/** Convenience: end a coach session (v0.8). */
const endCoachSession = (sessionId, input) => _default.coach.endSession(sessionId, input);
exports.endCoachSession = endCoachSession;
/** Convenience: current user's coach goals. */
const getMyCoachGoals = (opts) => _default.coach.goals(opts);
exports.getMyCoachGoals = getMyCoachGoals;
/**
 * Convenience: create a new coach goal.
 *
 * **v0.8 breaking change:** returns `{ goal: CoachGoal }` (was `CoachGoal`)
 * and accepts `targetDate`/`sessionId`. Legacy `dueDate` still accepted on
 * input until v0.9.
 */
const createCoachGoal = (input) => _default.coach.createGoal(input);
exports.createCoachGoal = createCoachGoal;
/**
 * Convenience: mark a coach goal as completed.
 *
 * **v0.8 breaking change:** returns `{ goal: CoachGoal }` (was
 * `{ ok, goalId, completed, completedAt }`).
 */
const completeCoachGoal = (goalId) => _default.coach.completeGoal(goalId);
exports.completeCoachGoal = completeCoachGoal;
/** Convenience: delete a coach goal (v0.8). */
const deleteCoachGoal = (goalId) => _default.coach.deleteGoal(goalId);
exports.deleteCoachGoal = deleteCoachGoal;
exports.default = AevionCatalog;
