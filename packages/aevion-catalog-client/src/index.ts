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

export interface CatalogListOptions {
  status?: string | string[];
  tag?: string | string[];
  kind?: string | string[];
  fields?: string[];
}

export interface AevionCatalogConfig {
  baseUrl?: string;
  fetch?: typeof fetch;
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

export default AevionCatalog;
