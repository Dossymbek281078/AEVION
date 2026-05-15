import { describe, expect, it, vi } from "vitest";
import { AevionCatalog } from "../src/index";

// ── helpers ────────────────────────────────────────────────────────────────

function mockFetch(response: { status?: number; body: unknown }) {
  return vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
    ok: (response.status ?? 200) < 400,
    status: response.status ?? 200,
    json: async () => response.body,
    text: async () => JSON.stringify(response.body),
  } as unknown as Response));
}

function makeClient(
  response: { status?: number; body: unknown },
  baseUrl?: string,
) {
  const fetchMock = mockFetch(response);
  const cat = new AevionCatalog({
    baseUrl,
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { cat, fetchMock };
}

function urlFrom(fetchMock: ReturnType<typeof mockFetch>): string {
  const call = fetchMock.mock.calls[0];
  return String(call?.[0] ?? "");
}

// ── tests ─────────────────────────────────────────────────────────────────

describe("AevionCatalog — constructor + baseUrl", () => {
  it("uses default baseUrl https://api.aevion.app", () => {
    const { cat } = makeClient({ body: {} });
    expect(cat.baseUrl).toBe("https://api.aevion.app");
  });

  it("strips trailing slashes from baseUrl", () => {
    const { cat } = makeClient({ body: {} }, "https://example.com/");
    expect(cat.baseUrl).toBe("https://example.com");
  });

  it("strips multiple trailing slashes", () => {
    const { cat } = makeClient({ body: {} }, "https://example.com////");
    expect(cat.baseUrl).toBe("https://example.com");
  });

  it("respects custom baseUrl", () => {
    const { cat } = makeClient({ body: {} }, "https://staging.aevion.app");
    expect(cat.baseUrl).toBe("https://staging.aevion.app");
  });

  it("throws when no global fetch and no config.fetch is provided", async () => {
    const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
    // Remove global fetch
    delete (globalThis as { fetch?: typeof fetch }).fetch;
    try {
      const cat = new AevionCatalog();
      await expect(cat.list()).rejects.toThrow(/global fetch is not available/);
    } finally {
      if (originalFetch) {
        (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
      }
    }
  });
});

describe("AevionCatalog.list — query building", () => {
  it("empty opts → /api/aevion/catalog with no query string", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.aevion.app/api/aevion/catalog",
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it("status: 'mvp' → ?status=mvp", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list({ status: "mvp" });
    const url = urlFrom(fetchMock);
    expect(url).toContain("status=mvp");
    expect(url.startsWith("https://api.aevion.app/api/aevion/catalog?")).toBe(true);
  });

  it("status: ['mvp', 'launched'] → encoded comma-joined list", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list({ status: ["mvp", "launched"] });
    const url = urlFrom(fetchMock);
    expect(url).toMatch(/status=(mvp%2Claunched|mvp,launched)/);
  });

  it("tag: ['ai', 'security'] → encoded list", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list({ tag: ["ai", "security"] });
    const url = urlFrom(fetchMock);
    expect(url).toMatch(/tag=(ai%2Csecurity|ai,security)/);
  });

  it("kind: 'core' → kind=core", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list({ kind: "core" });
    const url = urlFrom(fetchMock);
    expect(url).toContain("kind=core");
  });

  it("fields: ['id', 'name'] → fields=id,name", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list({ fields: ["id", "name"] });
    const url = urlFrom(fetchMock);
    expect(url).toMatch(/fields=(id%2Cname|id,name)/);
  });

  it("all filters combined → all params present", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list({
      status: "mvp",
      tag: ["ai", "security"],
      kind: "product",
      fields: ["id", "name", "status"],
    });
    const url = urlFrom(fetchMock);
    expect(url).toContain("status=mvp");
    expect(url).toMatch(/tag=(ai%2Csecurity|ai,security)/);
    expect(url).toContain("kind=product");
    expect(url).toMatch(/fields=(id%2Cname%2Cstatus|id,name,status)/);
  });

  it("returns parsed JSON body", async () => {
    const body = {
      total: 2,
      filters: { status: null, tag: null, kind: null },
      items: [{ id: "a" }, { id: "b" }],
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { cat } = makeClient({ body });
    const result = await cat.list();
    expect(result).toEqual(body);
  });

  it("throws on HTTP non-ok", async () => {
    const { cat } = makeClient({ status: 500, body: { error: "boom" } });
    await expect(cat.list()).rejects.toThrow(/HTTP 500/);
  });

  it("sends Accept: application/json header", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.list();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>)?.Accept).toBe("application/json");
  });
});

describe("AevionCatalog.get", () => {
  it("valid id → calls /api/aevion/catalog/<id>", async () => {
    const { cat, fetchMock } = makeClient({ body: { id: "qpersona" } });
    await cat.get("qpersona");
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/catalog/qpersona");
  });

  it("returns the parsed JSON item", async () => {
    const item = { id: "qpersona", name: "QPersona", tags: ["ai"] };
    const { cat } = makeClient({ body: item });
    const result = await cat.get("qpersona");
    expect(result).toEqual(item);
  });

  it("accepts ids with hyphens and digits", async () => {
    const { cat, fetchMock } = makeClient({ body: { id: "qbuild-v1" } });
    await cat.get("qbuild-v1");
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/catalog/qbuild-v1");
  });

  it("throws on invalid id with space", async () => {
    const { cat } = makeClient({ body: {} });
    await expect(cat.get("foo bar")).rejects.toThrow(/invalid moduleId/);
  });

  it("throws on empty id", async () => {
    const { cat } = makeClient({ body: {} });
    await expect(cat.get("")).rejects.toThrow(/invalid moduleId/);
  });

  it("throws on id with slash", async () => {
    const { cat } = makeClient({ body: {} });
    await expect(cat.get("foo/bar")).rejects.toThrow(/invalid moduleId/);
  });

  it("throws 'not found' on 404", async () => {
    const { cat } = makeClient({ status: 404, body: { error: "missing" } });
    await expect(cat.get("ghost")).rejects.toThrow(/not found/);
  });

  it("throws 'HTTP <status>' on other non-ok", async () => {
    const { cat } = makeClient({ status: 503, body: {} });
    await expect(cat.get("foo")).rejects.toThrow(/HTTP 503/);
  });
});

describe("AevionCatalog.stats", () => {
  it("calls /api/aevion/registry-stats", async () => {
    const { cat, fetchMock } = makeClient({
      body: { total: 0, byStatus: {}, byKind: {}, byTag: [], generatedAt: "" },
    });
    await cat.stats();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/registry-stats");
  });

  it("returns the parsed JSON", async () => {
    const body = {
      total: 27,
      byStatus: { mvp: 10, launched: 8 },
      byKind: { product: 20, core: 7 },
      byTag: [{ tag: "ai", count: 12 }],
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { cat } = makeClient({ body });
    const result = await cat.stats();
    expect(result).toEqual(body);
  });

  it("throws on HTTP non-ok", async () => {
    const { cat } = makeClient({ status: 500, body: {} });
    await expect(cat.stats()).rejects.toThrow(/HTTP 500/);
  });
});

describe("AevionCatalog.health", () => {
  it("calls /api/aevion/health", async () => {
    const { cat, fetchMock } = makeClient({
      body: {
        status: "ok",
        healthy: 3,
        total: 3,
        services: {},
        timestamp: "2026-05-12T00:00:00Z",
      },
    });
    await cat.health();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/health");
  });

  it("returns the parsed JSON", async () => {
    const body = {
      status: "degraded" as const,
      healthy: 2,
      total: 3,
      services: { foo: { ok: true, status: 200, durationMs: 12 } },
      timestamp: "2026-05-12T00:00:00Z",
    };
    const { cat } = makeClient({ body });
    const result = await cat.health();
    expect(result).toEqual(body);
  });

  it("throws on HTTP non-ok", async () => {
    const { cat } = makeClient({ status: 500, body: {} });
    await expect(cat.health()).rejects.toThrow(/HTTP 500/);
  });
});

describe("AevionCatalog.csvUrl / markdownUrl / badgeUrl — no fetch", () => {
  it("csvUrl with no opts → /api/aevion/catalog?format=csv", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    const url = cat.csvUrl();
    expect(url).toBe("https://api.aevion.app/api/aevion/catalog?format=csv");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("csvUrl with status filter includes status=", () => {
    const { cat } = makeClient({ body: {} });
    const url = cat.csvUrl({ status: "mvp" });
    expect(url).toContain("status=mvp");
    expect(url).toContain("format=csv");
  });

  it("markdownUrl with no opts → /api/aevion/catalog?format=md", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    const url = cat.markdownUrl();
    expect(url).toBe("https://api.aevion.app/api/aevion/catalog?format=md");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("markdownUrl with tag filter includes tag=", () => {
    const { cat } = makeClient({ body: {} });
    const url = cat.markdownUrl({ tag: ["ai", "security"] });
    expect(url).toContain("format=md");
    expect(url).toMatch(/tag=(ai%2Csecurity|ai,security)/);
  });

  it("badgeUrl returns /api/aevion/badges/<id>.svg", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    const url = cat.badgeUrl("qpersona");
    expect(url).toBe("https://api.aevion.app/api/aevion/badges/qpersona.svg");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("badgeUrl throws on invalid id with space", () => {
    const { cat } = makeClient({ body: {} });
    expect(() => cat.badgeUrl("foo bar")).toThrow(/invalid moduleId/);
  });

  it("badgeUrl throws on invalid id with slash", () => {
    const { cat } = makeClient({ body: {} });
    expect(() => cat.badgeUrl("foo/bar")).toThrow(/invalid moduleId/);
  });
});

describe("AevionCatalog v0.2 helpers", () => {
  it("searchByTag calls list with tag and returns items array", async () => {
    const items = [{ id: "a" }, { id: "b" }];
    const { cat, fetchMock } = makeClient({ body: { items, total: 2 } });
    const result = await cat.searchByTag("ai");
    expect(result).toEqual(items);
    expect(urlFrom(fetchMock)).toContain("tag=ai");
  });

  it("searchByTag accepts an array of tags", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.searchByTag(["ai", "ml"]);
    expect(urlFrom(fetchMock)).toMatch(/tag=(ai%2Cml|ai,ml)/);
  });

  it("byStatus calls list with status and returns items array", async () => {
    const items = [{ id: "qbuild" }];
    const { cat, fetchMock } = makeClient({ body: { items, total: 1 } });
    const result = await cat.byStatus("mvp");
    expect(result).toEqual(items);
    expect(urlFrom(fetchMock)).toContain("status=mvp");
  });

  it("byKind calls list with kind and returns items array", async () => {
    const items = [{ id: "core-thing" }];
    const { cat, fetchMock } = makeClient({ body: { items, total: 1 } });
    const result = await cat.byKind("core");
    expect(result).toEqual(items);
    expect(urlFrom(fetchMock)).toContain("kind=core");
  });

  it("mvpsAndLaunched calls list with status=mvp,launched", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    await cat.mvpsAndLaunched();
    expect(urlFrom(fetchMock)).toMatch(/status=(mvp%2Claunched|mvp,launched)/);
  });

  it("topTags(3) returns first 3 tags from stats().byTag", async () => {
    const body = {
      total: 0,
      byStatus: {},
      byKind: {},
      byTag: [
        { tag: "ai", count: 12 },
        { tag: "security", count: 8 },
        { tag: "fintech", count: 5 },
        { tag: "chess", count: 3 },
      ],
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { cat, fetchMock } = makeClient({ body });
    const result = await cat.topTags(3);
    expect(result).toEqual([
      { tag: "ai", count: 12 },
      { tag: "security", count: 8 },
      { tag: "fintech", count: 5 },
    ]);
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/registry-stats");
  });

  it("topTags() defaults to top-10", async () => {
    const byTag = Array.from({ length: 15 }, (_, i) => ({
      tag: `t${i}`,
      count: 15 - i,
    }));
    const { cat } = makeClient({
      body: { total: 0, byStatus: {}, byKind: {}, byTag, generatedAt: "" },
    });
    const result = await cat.topTags();
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ tag: "t0", count: 15 });
  });
});

describe("v0.4 graph helpers", () => {
  it("relatedModules(id) calls get(id) and returns its relatedModules array", async () => {
    const related = [
      { id: "qpersona", name: "QPersona", overlap: 3 },
      { id: "qcoreai", name: "QCoreAI", overlap: 2 },
    ];
    const { cat, fetchMock } = makeClient({
      body: { id: "qsign", name: "QSign", tags: ["ai", "security"], relatedModules: related },
    });
    const result = await cat.relatedModules("qsign");
    expect(result).toEqual(related);
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/catalog/qsign");
  });

  it("relatedModules(id) returns [] when get returns module without relatedModules", async () => {
    const { cat } = makeClient({
      body: { id: "qsign", name: "QSign", tags: ["security"] },
    });
    const result = await cat.relatedModules("qsign");
    expect(result).toEqual([]);
  });

  it("graph() calls list with fields projection, returns edges with from/to/overlap/score", async () => {
    const items = [
      { id: "a", name: "A", tags: ["x", "y", "z"] },
      { id: "b", name: "B", tags: ["x", "y"] },
      { id: "c", name: "C", tags: ["y", "z"] },
      { id: "d", name: "D", tags: ["q"] },
    ];
    const { cat, fetchMock } = makeClient({ body: { items, total: items.length } });
    const edges = await cat.graph();
    const url = urlFrom(fetchMock);
    expect(url).toMatch(/fields=(id%2Cname%2Ctags|id,name,tags)/);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(typeof e.from).toBe("string");
      expect(typeof e.to).toBe("string");
      expect(typeof e.overlap).toBe("number");
      expect(typeof e.score).toBe("number");
      expect(e.from).not.toBe(e.to);
    }
    // a has overlap with b and c
    const fromA = edges.filter((e) => e.from === "a").map((e) => e.to);
    expect(fromA).toContain("b");
    expect(fromA).toContain("c");
    // d has no overlap with others
    expect(edges.find((e) => e.from === "d")).toBeUndefined();
  });

  it("graph({ topK: 1 }) limits edges per node", async () => {
    const items = [
      { id: "a", name: "A", tags: ["x", "y", "z"] },
      { id: "b", name: "B", tags: ["x", "y"] },
      { id: "c", name: "C", tags: ["y", "z"] },
      { id: "d", name: "D", tags: ["x"] },
    ];
    const { cat } = makeClient({ body: { items, total: items.length } });
    const edges = await cat.graph({ topK: 1 });
    const byFrom: Record<string, number> = {};
    for (const e of edges) byFrom[e.from] = (byFrom[e.from] ?? 0) + 1;
    for (const count of Object.values(byFrom)) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it("neighbours(id) returns scored array, sorted by score desc", async () => {
    const me = { id: "a", name: "A", tags: ["x", "y", "z"] };
    const items = [
      me,
      { id: "b", name: "B", status: "mvp", tags: ["x", "y", "z"] }, // perfect overlap
      { id: "c", name: "C", status: "mvp", tags: ["x", "y"] }, // partial
      { id: "d", name: "D", status: "launched", tags: ["x"] }, // weakest
      { id: "e", name: "E", status: "idea", tags: ["q"] }, // no overlap
    ];
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => me,
          text: async () => JSON.stringify(me),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ items, total: items.length }),
        text: async () => JSON.stringify({ items, total: items.length }),
      } as unknown as Response;
    });
    const cat = new AevionCatalog({ fetch: fetchMock as unknown as typeof fetch });
    const result = await cat.neighbours("a");
    expect(result.length).toBe(3); // b, c, d (e excluded)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
    expect(result[0].id).toBe("b");
    expect(result[0].sharedTags.sort()).toEqual(["x", "y", "z"]);
    expect(result.find((r) => r.id === "e")).toBeUndefined();
  });

  it("neighbours(id) returns [] when source has no tags", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "a", name: "A", tags: [] }),
      text: async () => JSON.stringify({ id: "a", name: "A", tags: [] }),
    } as unknown as Response));
    const cat = new AevionCatalog({ fetch: fetchMock as unknown as typeof fetch });
    const result = await cat.neighbours("a");
    expect(result).toEqual([]);
    // Only one call (get); list should not have been invoked
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("v0.5 search + diff + fingerprint", () => {
  it("findByText('') returns []", async () => {
    const { cat, fetchMock } = makeClient({ body: { items: [], total: 0 } });
    const result = await cat.findByText("");
    expect(result).toEqual([]);
    // Should not call fetch at all
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("findByText('abc') calls list() with fields projection and returns sorted TextMatch[]", async () => {
    const items = [
      { id: "alpha", code: "alpha", name: "Alpha", description: "the abc tool", status: "mvp", tags: ["x"] },
      { id: "beta", code: "beta", name: "Abc Beta", description: "", status: "launched", tags: ["abc"] },
      { id: "gamma", code: "abc", name: "Gamma", description: "", status: "idea", tags: [] },
      { id: "delta", code: "delta", name: "Delta", description: "no match here", status: "idea", tags: ["zzz"] },
    ];
    const { cat, fetchMock } = makeClient({ body: { items, total: items.length } });
    const result = await cat.findByText("abc");
    const url = urlFrom(fetchMock);
    expect(url).toMatch(/fields=/);
    // delta has no "abc" anywhere → excluded
    expect(result.find((m) => m.id === "delta")).toBeUndefined();
    // sorted by score desc
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
    // each match has id/name/code/status/score
    for (const m of result) {
      expect(typeof m.id).toBe("string");
      expect(typeof m.name).toBe("string");
      expect(typeof m.code).toBe("string");
      expect(typeof m.status).toBe("string");
      expect(typeof m.score).toBe("number");
    }
  });

  it("findByText: name match scores higher than description match", async () => {
    const items = [
      { id: "desc", code: "desc", name: "Other", description: "this is foo land", status: "mvp", tags: [] },
      { id: "name", code: "name", name: "Foobar", description: "", status: "mvp", tags: [] },
    ];
    const { cat } = makeClient({ body: { items, total: items.length } });
    const result = await cat.findByText("foo");
    expect(result[0].id).toBe("name");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("diff(a, b) calls get twice and returns ModuleDiff with field/tag breakdown", async () => {
    const a = { id: "a", name: "A", code: "a", status: "mvp", kind: "product", priority: 1, tags: ["x", "y"] };
    const b = { id: "b", name: "B", code: "b", status: "launched", kind: "product", priority: 2, tags: ["y", "z"] };
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      const body = call === 1 ? a : b;
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    });
    const cat = new AevionCatalog({ fetch: fetchMock as unknown as typeof fetch });
    const d = await cat.diff("a", "b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(d.a).toEqual({ id: "a", name: "A" });
    expect(d.b).toEqual({ id: "b", name: "B" });
    // fields includes status/kind/priority
    const keys = d.fields.map((f) => f.key);
    expect(keys).toContain("status");
    expect(keys).toContain("kind");
    expect(keys).toContain("priority");
    // status differs, kind same, priority differs
    const statusF = d.fields.find((f) => f.key === "status")!;
    const kindF = d.fields.find((f) => f.key === "kind")!;
    expect(statusF.equal).toBe(false);
    expect(kindF.equal).toBe(true);
    // tag breakdown
    expect(d.tags.shared).toEqual(["y"]);
    expect(d.tags.onlyA).toEqual(["x"]);
    expect(d.tags.onlyB).toEqual(["z"]);
    expect(d.tags.jaccard).toBeCloseTo(1 / 3, 5);
  });

  it("diff(a, b) jaccard 1.0 when tag sets equal", async () => {
    const a = { id: "a", name: "A", code: "a", status: "mvp", kind: "product", priority: 1, tags: ["x", "y"] };
    const b = { id: "b", name: "B", code: "b", status: "mvp", kind: "product", priority: 1, tags: ["x", "y"] };
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      const body = call === 1 ? a : b;
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    });
    const cat = new AevionCatalog({ fetch: fetchMock as unknown as typeof fetch });
    const d = await cat.diff("a", "b");
    expect(d.tags.jaccard).toBe(1);
    expect(d.tags.onlyA).toEqual([]);
    expect(d.tags.onlyB).toEqual([]);
    for (const f of d.fields) expect(f.equal).toBe(true);
  });

  it("fingerprintModule(id) returns 8-char hex hash + length + generatedAt", async () => {
    const m = { id: "x", code: "x", name: "X", status: "mvp", kind: "product", priority: 1, tags: ["a", "b"] };
    const { cat } = makeClient({ body: m });
    const fp = await cat.fingerprintModule("x");
    expect(fp.id).toBe("x");
    expect(fp.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(typeof fp.length).toBe("number");
    expect(fp.length).toBeGreaterThan(0);
    expect(typeof fp.generatedAt).toBe("string");
    expect(() => new Date(fp.generatedAt).toISOString()).not.toThrow();
  });

  it("fingerprintModule(id) deterministic — same input → same hash", async () => {
    const m = { id: "x", code: "x", name: "X", status: "mvp", kind: "product", priority: 1, tags: ["b", "a"] };
    const { cat: cat1 } = makeClient({ body: m });
    const { cat: cat2 } = makeClient({ body: m });
    const fp1 = await cat1.fingerprintModule("x");
    const fp2 = await cat2.fingerprintModule("x");
    expect(fp1.hash).toBe(fp2.hash);
    expect(fp1.length).toBe(fp2.length);
  });
});

// ── v0.6: extendedStats + moduleOfTheDay ───────────────────────────────────

describe("AevionCatalog.extendedStats (v0.6)", () => {
  it("no opts → /api/aevion/stats with no query string", async () => {
    const body = {
      total: 0, byStatus: {}, byKind: {}, byPriority: {},
      topTags: [], coverage: {
        health: { count: 0, total: 0, percent: 0 },
        openapi: { count: 0, total: 0, percent: 0 },
      },
      recentActivity: [], generatedAt: "2026-01-01T00:00:00Z",
    };
    const { cat, fetchMock } = makeClient({ body });
    const s = await cat.extendedStats();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/stats");
    expect(s.total).toBe(0);
  });

  it("recent=5 → ?recent=5", async () => {
    const { cat, fetchMock } = makeClient({
      body: {
        total: 1, byStatus: {}, byKind: {}, byPriority: {}, topTags: [],
        coverage: { health: { count: 0, total: 1, percent: 0 }, openapi: { count: 0, total: 1, percent: 0 } },
        recentActivity: [], generatedAt: "x",
      },
    });
    await cat.extendedStats({ recent: 5 });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/stats?recent=5");
  });

  it("recent clamped to [1..50] client-side before sending", async () => {
    const { cat, fetchMock } = makeClient({
      body: {
        total: 0, byStatus: {}, byKind: {}, byPriority: {}, topTags: [],
        coverage: { health: { count: 0, total: 0, percent: 0 }, openapi: { count: 0, total: 0, percent: 0 } },
        recentActivity: [], generatedAt: "x",
      },
    });
    await cat.extendedStats({ recent: 999 });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/stats?recent=50");
    fetchMock.mockClear();
    await cat.extendedStats({ recent: 0 });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/stats?recent=1");
  });

  it("throws on HTTP error", async () => {
    const { cat } = makeClient({ status: 500, body: { error: "boom" } });
    await expect(cat.extendedStats()).rejects.toThrow(/HTTP 500/);
  });
});

describe("AevionCatalog.moduleOfTheDay (v0.6)", () => {
  const sampleBody = {
    date: "2026-05-13", dayOfYear: 132, registrySize: 30,
    module: {
      id: "qright", code: "QRIGHT", name: "QRight", description: "",
      kind: "product", status: "mvp", priority: 1, tags: ["ip"],
      frontend: "https://aevion.app/qright",
      ogImage: "https://aevion.app/qright/opengraph-image",
      health: null, openapi: null, waitlist: null, status_url: null,
      relatedModules: [],
    },
    tomorrow: { id: "qsign", code: "QSIGN", name: "QSign" },
    generatedAt: "2026-05-13T00:00:00Z",
  };

  it("no opts → /api/aevion/module-of-the-day with no query string", async () => {
    const { cat, fetchMock } = makeClient({ body: sampleBody });
    const m = await cat.moduleOfTheDay();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/aevion/module-of-the-day");
    expect(m.module.id).toBe("qright");
    expect(m.tomorrow.id).toBe("qsign");
  });

  it("date='2026-05-13' → ?date=2026-05-13", async () => {
    const { cat, fetchMock } = makeClient({ body: sampleBody });
    await cat.moduleOfTheDay({ date: "2026-05-13" });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/aevion/module-of-the-day?date=2026-05-13",
    );
  });

  it("rejects invalid date format before sending", async () => {
    const { cat, fetchMock } = makeClient({ body: sampleBody });
    await expect(cat.moduleOfTheDay({ date: "yesterday" })).rejects.toThrow(
      /invalid date 'yesterday'/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on HTTP 503 (empty registry)", async () => {
    const { cat } = makeClient({ status: 503, body: { error: "registry-empty" } });
    await expect(cat.moduleOfTheDay()).rejects.toThrow(/HTTP 503/);
  });
});

// ── v0.6: QStore ───────────────────────────────────────────────────────────

describe("AevionCatalog.qstore (v0.6)", () => {
  it("products() with no opts → /api/qstore/products (no query)", async () => {
    const { cat, fetchMock } = makeClient({
      body: { total: 0, sort: "popular", items: [] },
    });
    const r = await cat.qstore.products();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qstore/products");
    expect(r.total).toBe(0);
  });

  it("products({ sort: 'trending' }) → ?sort=trending", async () => {
    const { cat, fetchMock } = makeClient({
      body: { total: 1, sort: "trending", items: [{ id: "p1", title: "Hot" }] },
    });
    await cat.qstore.products({ sort: "trending" });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qstore/products?sort=trending",
    );
  });

  it("products({ sort: 'bogus' }) throws before sending", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(() => cat.qstore.products({ sort: "bogus" as unknown as "popular" })).toThrow(
      /invalid sort/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("featured() with no opts → /api/qstore/featured (no query)", async () => {
    const body = { popular: [], trending: [], newest: [], topRated: [] };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qstore.featured();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qstore/featured");
    expect(r).toEqual(body);
  });

  it("featured({ limit: 999 }) clamps to ?limit=50", async () => {
    const { cat, fetchMock } = makeClient({
      body: { popular: [], trending: [], newest: [], topRated: [] },
    });
    await cat.qstore.featured({ limit: 999 });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qstore/featured?limit=50");
  });

  it("products() throws on HTTP error", async () => {
    const { cat } = makeClient({ status: 500, body: {} });
    await expect(cat.qstore.products()).rejects.toThrow(/HTTP 500/);
  });
});

// ── v0.6: QLearn ───────────────────────────────────────────────────────────

describe("AevionCatalog.qlearn (v0.6)", () => {
  it("bookmark(id) → POST /api/qlearn/courses/:id/bookmark", async () => {
    const { cat, fetchMock } = makeClient({
      body: { ok: true, bookmarked: true, courseId: "smeta-101" },
    });
    const r = await cat.qlearn.bookmark("smeta-101");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qlearn/courses/smeta-101/bookmark",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(r.bookmarked).toBe(true);
  });

  it("unbookmark(id) → DELETE /api/qlearn/courses/:id/bookmark", async () => {
    const { cat, fetchMock } = makeClient({
      body: { ok: true, bookmarked: false, courseId: "smeta-101" },
    });
    await cat.qlearn.unbookmark("smeta-101");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("DELETE");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qlearn/courses/smeta-101/bookmark",
    );
  });

  it("bookmark('') throws on invalid courseId", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(cat.qlearn.bookmark("")).rejects.toThrow(/invalid courseId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bookmarks() → GET /api/qlearn/me/bookmarks", async () => {
    const body = { total: 1, items: [{ id: "c1", title: "Course One" }] };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qlearn.bookmarks();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qlearn/me/bookmarks");
    expect(r).toEqual(body);
  });

  it("streak() → GET /api/qlearn/me/streak with full shape", async () => {
    const body = {
      current: 4,
      longest: 12,
      totalDays: 30,
      activeToday: true,
      lastActiveAt: "2026-05-13T12:00:00Z",
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qlearn.streak();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qlearn/me/streak");
    expect(r.current).toBe(4);
    expect(r.activeToday).toBe(true);
  });

  it("progress() → GET /api/qlearn/me/progress", async () => {
    const body = {
      summary: { total: 5, completed: 1, inProgress: 2, notStarted: 2 },
      continueLearning: [{ courseId: "c1", progress: 0.4 }],
      notStarted: [{ courseId: "c2", progress: 0 }],
      completed: [{ courseId: "c3", progress: 1, completedAt: "2026-05-01" }],
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qlearn.progress();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qlearn/me/progress");
    expect(r.summary.total).toBe(5);
    expect(r.continueLearning).toHaveLength(1);
  });
});

// ── v0.6: QEvents ──────────────────────────────────────────────────────────

describe("AevionCatalog.qevents (v0.6)", () => {
  it("list() with no opts → /api/qevents/events", async () => {
    const { cat, fetchMock } = makeClient({
      body: { total: 0, when: "upcoming", items: [] },
    });
    await cat.qevents.list();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qevents/events");
  });

  it("list({ when: 'past' }) → ?when=past", async () => {
    const { cat, fetchMock } = makeClient({
      body: { total: 0, when: "past", items: [] },
    });
    await cat.qevents.list({ when: "past" });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qevents/events?when=past",
    );
  });

  it("list({ when: 'sometime' }) throws before sending", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(() =>
      cat.qevents.list({ when: "sometime" as unknown as "upcoming" }),
    ).toThrow(/invalid when/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ics(id) → GET /api/qevents/events/:id/ics returning raw text", async () => {
    const icsText = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => icsText,
    } as unknown as Response));
    const cat = new AevionCatalog({ fetch: fetchMock as unknown as typeof fetch });
    const r = await cat.qevents.ics("evt-1");
    expect(r).toBe(icsText);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.aevion.app/api/qevents/events/evt-1/ics",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>)?.Accept).toBe("text/calendar");
  });

  it("icsUrl(id) returns URL without fetching", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(cat.qevents.icsUrl("evt-42")).toBe(
      "https://api.aevion.app/api/qevents/events/evt-42/ics",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ics('') throws on invalid eventId", async () => {
    const { cat } = makeClient({ body: "" });
    await expect(cat.qevents.ics("")).rejects.toThrow(/invalid eventId/);
  });
});

// ── v0.6: DevHub ───────────────────────────────────────────────────────────

describe("AevionCatalog.devhub (v0.6)", () => {
  it("snippets() with no opts → /api/devhub/snippets", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.devhub.snippets();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/devhub/snippets");
  });

  it("snippets({ limit, tag, user }) sends all three query params", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.devhub.snippets({ limit: 10, tag: "ts", user: "alice" });
    const url = urlFrom(fetchMock);
    expect(url).toContain("limit=10");
    expect(url).toContain("tag=ts");
    expect(url).toContain("user=alice");
  });

  it("createSnippet(...) → POST /api/devhub/snippets with JSON body", async () => {
    const created = {
      id: "s1",
      title: "Hello",
      content: "console.log(1)",
      language: "ts",
      tags: ["demo"],
    };
    const { cat, fetchMock } = makeClient({ body: created });
    const r = await cat.devhub.createSnippet({
      title: "Hello",
      content: "console.log(1)",
      language: "ts",
      tags: ["demo"],
    });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/devhub/snippets");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)?.["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(String((init as { body?: string })?.body))).toEqual({
      title: "Hello",
      content: "console.log(1)",
      language: "ts",
      tags: ["demo"],
    });
    expect(r).toEqual(created);
  });

  it("createSnippet without title throws synchronously", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(() =>
      cat.devhub.createSnippet({ title: "", content: "x", language: "ts" }),
    ).toThrow(/missing title/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getSnippet(id) → GET /api/devhub/snippets/:id", async () => {
    const body = {
      id: "abc",
      title: "T",
      content: "C",
      language: "ts",
      tags: [],
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.devhub.getSnippet("abc");
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/devhub/snippets/abc");
    expect(r).toEqual(body);
  });

  it("star(id) → POST /api/devhub/snippets/:id/star", async () => {
    const { cat, fetchMock } = makeClient({
      body: { ok: true, starred: true, snippetId: "abc", stars: 7 },
    });
    const r = await cat.devhub.star("abc");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/devhub/snippets/abc/star",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(r.stars).toBe(7);
  });

  it("star('') throws on invalid snippetId", async () => {
    const { cat } = makeClient({ body: {} });
    await expect(cat.devhub.star("")).rejects.toThrow(/invalid snippetId/);
  });
});

// ── v0.6: Planet ───────────────────────────────────────────────────────────

describe("AevionCatalog.planet (v0.6)", () => {
  it("activity() with no opts → /api/planet/activity (no query)", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.planet.activity();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/planet/activity");
  });

  it("activity({ limit: 5, kinds: ['release','post'] }) → ?limit=5&kinds=release,post", async () => {
    const body = {
      total: 1,
      items: [
        {
          id: "a1",
          kind: "release",
          createdAt: "2026-05-13T10:00:00Z",
        },
      ],
    };
    const { cat, fetchMock } = makeClient({ body });
    await cat.planet.activity({ limit: 5, kinds: ["release", "post"] });
    const url = urlFrom(fetchMock);
    expect(url).toContain("limit=5");
    expect(url).toMatch(/kinds=(release%2Cpost|release,post)/);
  });

  it("activity({ kinds: 'event' }) accepts a single string", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.planet.activity({ kinds: "event" });
    expect(urlFrom(fetchMock)).toContain("kinds=event");
  });

  it("activity() returns parsed items with kind", async () => {
    const body = {
      total: 1,
      items: [
        {
          id: "x",
          kind: "module_update",
          module: "qsign",
          createdAt: "2026-05-13T10:00:00Z",
        },
      ],
    };
    const { cat } = makeClient({ body });
    const r = await cat.planet.activity();
    expect(r.items[0].kind).toBe("module_update");
    expect(r.items[0].module).toBe("qsign");
  });
});

// ── v0.6: shared headers + custom config ───────────────────────────────────

describe("AevionCatalog v0.6 shared infra", () => {
  it("config.headers is applied to sub-client requests", async () => {
    const fetchMock = mockFetch({
      body: { total: 0, sort: "popular", items: [] },
    });
    const cat = new AevionCatalog({
      fetch: fetchMock as unknown as typeof fetch,
      headers: { Authorization: "Bearer test-token", "X-User-Id": "u1" },
    });
    await cat.qstore.products();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const h = (init?.headers as Record<string, string>) ?? {};
    expect(h.Authorization).toBe("Bearer test-token");
    expect(h["X-User-Id"]).toBe("u1");
    // Accept still set to application/json
    expect(h.Accept).toBe("application/json");
  });

  it("sub-clients are wired on the root client", () => {
    const { cat } = makeClient({ body: {} });
    expect(cat.qstore).toBeDefined();
    expect(cat.qlearn).toBeDefined();
    expect(cat.qevents).toBeDefined();
    expect(cat.devhub).toBeDefined();
    expect(cat.planet).toBeDefined();
  });
});

// ── v0.7: QCoreAI ──────────────────────────────────────────────────────────

describe("AevionCatalog.qcoreai (v0.7)", () => {
  it("providers() → GET /api/qcoreai/providers", async () => {
    const body = {
      providers: [
        { id: "openai", name: "OpenAI", enabled: true, models: ["gpt-4o"] },
        { id: "anthropic", name: "Anthropic", enabled: true, models: ["claude-opus-4.7"] },
      ],
      count: 2,
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qcoreai.providers();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qcoreai/providers");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("GET");
    expect(r.providers).toHaveLength(2);
    expect(r.providers[0].id).toBe("openai");
  });

  it("health() → GET /api/qcoreai/health", async () => {
    const body = {
      status: "ok",
      providers: { openai: { ok: true, status: 200, durationMs: 42 } },
      timestamp: "2026-05-14T00:00:00Z",
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qcoreai.health();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qcoreai/health");
    expect(r.status).toBe("ok");
  });

  it("chat(...) → POST /api/qcoreai/chat with JSON body", async () => {
    const reply = {
      provider: "openai",
      model: "gpt-4o",
      message: { role: "assistant", content: "hi" },
    };
    const { cat, fetchMock } = makeClient({ body: reply });
    const r = await cat.qcoreai.chat({
      provider: "openai",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.7,
    });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qcoreai/chat");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)?.["Content-Type"]).toBe(
      "application/json",
    );
    const parsed = JSON.parse(String((init as { body?: string })?.body));
    expect(parsed.provider).toBe("openai");
    expect(parsed.model).toBe("gpt-4o");
    expect(parsed.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(parsed.temperature).toBe(0.7);
    expect(r).toEqual(reply);
  });

  it("chat() with empty messages throws synchronously", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(() => cat.qcoreai.chat({ messages: [] })).toThrow(/missing messages/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── v0.7: Multichat ────────────────────────────────────────────────────────

describe("AevionCatalog.multichat (v0.7)", () => {
  it("providerStatus() → GET /api/multichat/provider-status", async () => {
    const body = {
      providers: [
        { id: "openai", name: "OpenAI", status: "online", latencyMs: 120 },
        { id: "anthropic", name: "Anthropic", status: "online", latencyMs: 200 },
      ],
      generatedAt: "2026-05-14T00:00:00Z",
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.multichat.providerStatus();
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/multichat/provider-status",
    );
    expect(r.providers).toHaveLength(2);
    expect(r.providers[0].status).toBe("online");
  });

  it("presets() → GET /api/multichat/presets", async () => {
    const body = {
      total: 1,
      presets: [
        { id: "brainstorm", name: "Brainstorm", providers: ["openai", "anthropic"] },
      ],
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.multichat.presets();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/multichat/presets");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("GET");
    expect(r.presets[0].id).toBe("brainstorm");
  });

  it("launchPreset(id) → POST /api/multichat/presets/:id/launch", async () => {
    const body = {
      ok: true,
      sessionId: "sess-123",
      presetId: "brainstorm",
      providers: ["openai", "anthropic"],
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.multichat.launchPreset("brainstorm");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/multichat/presets/brainstorm/launch",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(r.sessionId).toBe("sess-123");
    expect(r.ok).toBe(true);
  });

  it("launchPreset('') throws on invalid presetId", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(cat.multichat.launchPreset("")).rejects.toThrow(/invalid presetId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── v0.7: QMedia ───────────────────────────────────────────────────────────

describe("AevionCatalog.qmedia (v0.7)", () => {
  it("recommendations() with no opts → /api/qmedia/recommendations (no query)", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.qmedia.recommendations();
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qmedia/recommendations",
    );
  });

  it("recommendations({ limit: 10 }) → ?limit=10", async () => {
    const body = {
      total: 1,
      items: [{ id: "t1", title: "Theta Wave", durationSec: 1800 }],
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qmedia.recommendations({ limit: 10 });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qmedia/recommendations?limit=10",
    );
    expect(r.items[0].id).toBe("t1");
  });

  it("recommendations({ limit: 999 }) clamps to ?limit=100", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.qmedia.recommendations({ limit: 999 });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qmedia/recommendations?limit=100",
    );
  });

  it("trending() → GET /api/qmedia/trending", async () => {
    const body = {
      total: 2,
      items: [
        { id: "t1", title: "Hot 1" },
        { id: "t2", title: "Hot 2" },
      ],
      window: "24h",
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qmedia.trending();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qmedia/trending");
    expect(r.items).toHaveLength(2);
    expect(r.window).toBe("24h");
  });

  it("tracks() → GET /api/qmedia/tracks", async () => {
    const body = { total: 1, items: [{ id: "t1", title: "Solo" }] };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qmedia.tracks();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qmedia/tracks");
    expect(r.items[0].title).toBe("Solo");
  });
});

// ── v0.7: Coach ────────────────────────────────────────────────────────────

describe("AevionCatalog.coach (v0.7)", () => {
  it("sessions() → GET /api/coach/sessions", async () => {
    const body = {
      total: 1,
      items: [{ id: "s1", title: "Week 1 check-in", durationMin: 30 }],
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.coach.sessions();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/coach/sessions");
    expect(r.items[0].id).toBe("s1");
  });

  it("goals() with no opts → /api/coach/goals (no query)", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.coach.goals();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/coach/goals");
  });

  it("goals({ completed: true }) → ?completed=true", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.coach.goals({ completed: true });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/goals?completed=true",
    );
  });

  it("goals({ completed: false }) → ?completed=false", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.coach.goals({ completed: false });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/goals?completed=false",
    );
  });

  it("createGoal accepts legacy { title, description, dueDate } and forwards as targetDate (v0.8 transition)", async () => {
    // v0.8: backend renamed dueDate → targetDate. SDK still accepts legacy
    // dueDate for one transition release.
    const created = {
      goal: {
        id: "g1",
        title: "Ship v0.7",
        description: "Add 4 sub-clients",
        targetDate: "2026-06-01",
        completed: false,
      },
    };
    const { cat, fetchMock } = makeClient({ body: created });
    const r = await cat.coach.createGoal({
      title: "Ship v0.7",
      description: "Add 4 sub-clients",
      dueDate: "2026-06-01",
    });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/coach/goals");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)?.["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(String((init as { body?: string })?.body))).toEqual({
      title: "Ship v0.7",
      description: "Add 4 sub-clients",
      targetDate: "2026-06-01",
    });
    expect(r).toEqual(created);
  });

  it("createGoal without title throws synchronously", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(() => cat.coach.createGoal({ title: "" })).toThrow(/missing title/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createGoal with invalid (legacy) dueDate throws synchronously", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(() =>
      cat.coach.createGoal({ title: "x", dueDate: "tomorrow" }),
    ).toThrow(/invalid targetDate/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("completeGoal(id) → POST /api/coach/goals/:id/complete (v0.8 returns { goal })", async () => {
    const body = {
      goal: {
        id: "g1",
        title: "ship",
        completed: true,
        completedAt: "2026-05-14T10:00:00Z",
      },
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.coach.completeGoal("g1");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/goals/g1/complete",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(r.goal.completed).toBe(true);
    expect(r.goal.id).toBe("g1");
  });

  it("completeGoal('') throws on missing goalId", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(cat.coach.completeGoal("")).rejects.toThrow(/missing goalId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── v0.7: sub-clients wired ────────────────────────────────────────────────

describe("AevionCatalog v0.7 shared infra", () => {
  it("new sub-clients are wired on the root client", () => {
    const { cat } = makeClient({ body: {} });
    expect(cat.qcoreai).toBeDefined();
    expect(cat.multichat).toBeDefined();
    expect(cat.qmedia).toBeDefined();
    expect(cat.coach).toBeDefined();
  });

  it("config.headers is forwarded to v0.7 sub-client requests", async () => {
    const fetchMock = mockFetch({ body: { providers: [], count: 0 } });
    const cat = new AevionCatalog({
      fetch: fetchMock as unknown as typeof fetch,
      headers: { Authorization: "Bearer v07-token", "X-User-Id": "u7" },
    });
    await cat.qcoreai.providers();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const h = (init?.headers as Record<string, string>) ?? {};
    expect(h.Authorization).toBe("Bearer v07-token");
    expect(h["X-User-Id"]).toBe("u7");
    expect(h.Accept).toBe("application/json");
  });
});

// ── v0.8: QMedia videos + recordPlay ───────────────────────────────────────

describe("AevionCatalog.qmedia v0.8 — videos + recordPlay", () => {
  it("videos() with no opts → GET /api/qmedia/videos (no query)", async () => {
    const body = { total: 0, items: [] };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qmedia.videos();
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/qmedia/videos");
    expect(r.items).toEqual([]);
  });

  it("videos({ limit: 20 }) → ?limit=20", async () => {
    const body = {
      total: 1,
      items: [
        { id: "v1", title: "Tutorial", category: "tutorial", viewCount: 42 },
      ],
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.qmedia.videos({ limit: 20 });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qmedia/videos?limit=20",
    );
    expect(r.items[0].id).toBe("v1");
    expect(r.items[0].viewCount).toBe(42);
  });

  it("videos({ limit: 999 }) clamps to ?limit=50 (matches backend)", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.qmedia.videos({ limit: 999 });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qmedia/videos?limit=50",
    );
  });

  it("videos({ limit: 10, offset: 20 }) → ?limit=10&offset=20", async () => {
    const { cat, fetchMock } = makeClient({ body: { total: 0, items: [] } });
    await cat.qmedia.videos({ limit: 10, offset: 20 });
    const url = urlFrom(fetchMock);
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=20");
  });

  it("recordPlay(id) → POST /api/qmedia/tracks/:id/play, normalises playCount → plays", async () => {
    const { cat, fetchMock } = makeClient({ body: { playCount: 7 } });
    const r = await cat.qmedia.recordPlay("t1");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/qmedia/tracks/t1/play",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(r.ok).toBe(true);
    expect(r.plays).toBe(7);
    expect(r.playCount).toBe(7);
  });

  it("recordPlay('') throws synchronously on invalid trackId", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(cat.qmedia.recordPlay("")).rejects.toThrow(/invalid trackId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── v0.8: Coach mutation API ───────────────────────────────────────────────

describe("AevionCatalog.coach v0.8 — startSession", () => {
  it("startSession({ topic }) → POST /api/coach/sessions/start, returns bare session", async () => {
    const body = {
      session: {
        id: "s-100",
        ownerKey: "user-1",
        topic: "Sicilian defence",
        startedAt: "2026-05-14T08:00:00Z",
        messageCount: 0,
        goalsLinked: [],
      },
    };
    const { cat, fetchMock } = makeClient({ body });
    const session = await cat.coach.startSession({ topic: "Sicilian defence" });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/sessions/start",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String((init as { body?: string })?.body))).toEqual({
      topic: "Sicilian defence",
    });
    expect(session.id).toBe("s-100");
    expect(session.topic).toBe("Sicilian defence");
  });

  it("startSession({ topic, fen }) → forwards fen as startingFen", async () => {
    const body = { session: { id: "s-101", topic: "endgame", startingFen: "8/8/8/8/4k3/8/8/4K3 w - - 0 1" } };
    const { cat, fetchMock } = makeClient({ body });
    await cat.coach.startSession({
      topic: "endgame",
      fen: "8/8/8/8/4k3/8/8/4K3 w - - 0 1",
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String((init as { body?: string })?.body))).toEqual({
      topic: "endgame",
      startingFen: "8/8/8/8/4k3/8/8/4K3 w - - 0 1",
    });
  });

  it("startSession({ topic: '' }) rejects with missing topic", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(cat.coach.startSession({ topic: "" })).rejects.toThrow(
      /missing topic/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AevionCatalog.coach v0.8 — endSession", () => {
  it("endSession(id, { notes, messageCount }) → POST /sessions/:id/end, returns bare session", async () => {
    const body = {
      session: {
        id: "s-200",
        topic: "openings",
        startedAt: "2026-05-14T08:00:00Z",
        endedAt: "2026-05-14T08:30:00Z",
        durationSec: 1800,
        notes: "Solid recap",
        messageCount: 12,
      },
    };
    const { cat, fetchMock } = makeClient({ body });
    const session = await cat.coach.endSession("s-200", {
      notes: "Solid recap",
      messageCount: 12,
    });
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/sessions/s-200/end",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String((init as { body?: string })?.body))).toEqual({
      notes: "Solid recap",
      messageCount: 12,
    });
    expect(session.endedAt).toBe("2026-05-14T08:30:00Z");
    expect(session.messageCount).toBe(12);
  });

  it("endSession with negative messageCount rejects", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(
      cat.coach.endSession("s-201", { messageCount: -1 }),
    ).rejects.toThrow(/messageCount/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("endSession('') rejects with missing sessionId", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(cat.coach.endSession("", {})).rejects.toThrow(
      /missing sessionId/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AevionCatalog.coach v0.8 — createGoal (BREAKING)", () => {
  it("createGoal({ title, targetDate, sessionId }) → POST returns { goal }", async () => {
    const body = {
      goal: {
        id: "g-100",
        title: "Reach 1600 ELO",
        targetDate: "2026-09-01",
        sessionId: "s-100",
        completed: false,
        createdAt: "2026-05-14T08:00:00Z",
      },
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.coach.createGoal({
      title: "Reach 1600 ELO",
      targetDate: "2026-09-01",
      sessionId: "s-100",
    });
    expect(urlFrom(fetchMock)).toBe("https://api.aevion.app/api/coach/goals");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String((init as { body?: string })?.body))).toEqual({
      title: "Reach 1600 ELO",
      targetDate: "2026-09-01",
      sessionId: "s-100",
    });
    expect(r.goal.id).toBe("g-100");
    expect(r.goal.targetDate).toBe("2026-09-01");
  });

  it("createGoal accepts legacy dueDate and forwards as targetDate", async () => {
    const body = { goal: { id: "g-101", title: "Legacy goal", targetDate: "2026-06-01", completed: false } };
    const { cat, fetchMock } = makeClient({ body });
    await cat.coach.createGoal({ title: "Legacy goal", dueDate: "2026-06-01" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const sent = JSON.parse(String((init as { body?: string })?.body));
    expect(sent.targetDate).toBe("2026-06-01");
    expect(sent.dueDate).toBeUndefined();
  });

  it("createGoal with invalid targetDate throws synchronously", () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    expect(() =>
      cat.coach.createGoal({ title: "x", targetDate: "not-a-date" }),
    ).toThrow(/invalid targetDate/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createGoal returns { goal } even when backend wraps response", async () => {
    const body = { goal: { id: "g-200", title: "Minimal", completed: false } };
    const { cat } = makeClient({ body });
    const r = await cat.coach.createGoal({ title: "Minimal" });
    expect(r).toHaveProperty("goal");
    expect(r.goal.id).toBe("g-200");
  });
});

describe("AevionCatalog.coach v0.8 — completeGoal (BREAKING)", () => {
  it("completeGoal(id) → POST returns { goal }", async () => {
    const body = {
      goal: {
        id: "g-300",
        title: "Done thing",
        completed: true,
        completedAt: "2026-05-14T10:00:00Z",
      },
    };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.coach.completeGoal("g-300");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/goals/g-300/complete",
    );
    expect(r.goal.completed).toBe(true);
    expect(r.goal.id).toBe("g-300");
  });

  it("completeGoal preserves URL-encoded ids with special chars", async () => {
    const body = { goal: { id: "g/weird", title: "x", completed: true } };
    const { cat, fetchMock } = makeClient({ body });
    await cat.coach.completeGoal("g/weird");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/goals/g%2Fweird/complete",
    );
  });
});

describe("AevionCatalog.coach v0.8 — deleteGoal + getSession", () => {
  it("deleteGoal(id) → DELETE returns { ok: true } even when server returns 204", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
      text: async () => "",
    } as unknown as Response));
    const cat = new AevionCatalog({ fetch: fetchMock as unknown as typeof fetch });
    const r = await cat.coach.deleteGoal("g-400");
    const call = fetchMock.mock.calls[0];
    expect(String(call?.[0])).toBe(
      "https://api.aevion.app/api/coach/goals/g-400",
    );
    const init = call?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("DELETE");
    expect(r).toEqual({ ok: true });
  });

  it("deleteGoal('') throws synchronously", async () => {
    const { cat, fetchMock } = makeClient({ body: {} });
    await expect(cat.coach.deleteGoal("")).rejects.toThrow(/missing goalId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getSession(id) → GET /api/coach/sessions/:id → { session }", async () => {
    const body = { session: { id: "s-500", topic: "tactics", messageCount: 4 } };
    const { cat, fetchMock } = makeClient({ body });
    const r = await cat.coach.getSession("s-500");
    expect(urlFrom(fetchMock)).toBe(
      "https://api.aevion.app/api/coach/sessions/s-500",
    );
    expect(r.session.id).toBe("s-500");
    expect(r.session.topic).toBe("tactics");
  });
});

describe("AevionCatalog v0.8 shared infra", () => {
  it("v0.8 Coach + QMedia methods exist on sub-clients", () => {
    const { cat } = makeClient({ body: {} });
    expect(typeof cat.qmedia.videos).toBe("function");
    expect(typeof cat.qmedia.recordPlay).toBe("function");
    expect(typeof cat.coach.startSession).toBe("function");
    expect(typeof cat.coach.endSession).toBe("function");
    expect(typeof cat.coach.getSession).toBe("function");
    expect(typeof cat.coach.deleteGoal).toBe("function");
  });

  it("config.headers is forwarded to v0.8 endpoints", async () => {
    const fetchMock = mockFetch({ body: { total: 0, items: [] } });
    const cat = new AevionCatalog({
      fetch: fetchMock as unknown as typeof fetch,
      headers: { Authorization: "Bearer v08-token" },
    });
    await cat.qmedia.videos({ limit: 5 });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const h = (init?.headers as Record<string, string>) ?? {};
    expect(h.Authorization).toBe("Bearer v08-token");
  });
});
