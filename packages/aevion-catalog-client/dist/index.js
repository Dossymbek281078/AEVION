"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fingerprintModule = exports.diff = exports.findByText = exports.getNeighbours = exports.getGraph = exports.getRelatedModules = exports.getSitemap = exports.getOpenApi = exports.topTags = exports.mvpsAndLaunched = exports.byKind = exports.byStatus = exports.searchByTag = exports.getHealth = exports.getStats = exports.getModule = exports.listCatalog = exports.AevionCatalog = void 0;
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
exports.default = AevionCatalog;
