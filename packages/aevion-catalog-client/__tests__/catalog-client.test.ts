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
