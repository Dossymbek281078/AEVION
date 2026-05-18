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
export declare class AevionCatalog {
    readonly baseUrl: string;
    private readonly _fetch;
    constructor(config?: AevionCatalogConfig);
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
export default AevionCatalog;
