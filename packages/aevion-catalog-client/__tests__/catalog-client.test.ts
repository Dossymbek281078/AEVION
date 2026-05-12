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
