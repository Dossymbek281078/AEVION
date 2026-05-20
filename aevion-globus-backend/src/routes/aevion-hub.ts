/**
 * AEVION Hub — composite cross-product endpoints.
 *
 * Aggregates health and OpenAPI specs from every planetary module so consumers
 * can monitor the whole stack (qsign + qshield + qright + pipeline + planet)
 * with a single GET. The hub does not itself touch DB tables — it just
 * cascades downstream calls.
 */

import { Router, type Request } from "express";
import { projects } from "../data/projects";

export const aevionHubRouter = Router();

const SUB_HEALTH = [
  { name: "pipeline", path: "/api/pipeline/health" },
  { name: "qsign-v2", path: "/api/qsign/v2/health" },
  { name: "qsign-legacy", path: "/api/qsign/health" },
  { name: "quantum-shield", path: "/api/quantum-shield/health" },
  { name: "qright", path: "/api/qright/health" },
  { name: "planet", path: "/api/planet/health" },
  { name: "bureau", path: "/api/bureau/health" },
  { name: "auth", path: "/api/auth/health" },
  { name: "qcontract", path: "/api/qcontract/health" },
  { name: "qpaynet", path: "/api/qpaynet/health" },
  { name: "devhub", path: "/api/devhub/health" },
  { name: "smeta-trainer", path: "/api/smeta-trainer/health" },
  { name: "healthai", path: "/api/healthai/health" },
  { name: "qtradeoffline", path: "/api/qtradeoffline/health" },
  { name: "qfusionai", path: "/api/qfusionai/health" },
  { name: "veilnetx", path: "/api/veilnetx/health" },
  { name: "qgood", path: "/api/qgood/health" },
  { name: "voice-of-earth", path: "/api/voice-of-earth/health" },
  { name: "kids-ai-content", path: "/api/kids-ai-content/health" },
  { name: "startup-exchange", path: "/api/startup-exchange/health" },
  { name: "shadownet", path: "/api/shadownet/health" },
  { name: "deepsan", path: "/api/deepsan/health" },
  { name: "qmaskcard", path: "/api/qmaskcard/health" },
  { name: "qpersona", path: "/api/qpersona/health" },
  { name: "qlife", path: "/api/qlife/health" },
  { name: "psyapp-deps", path: "/api/psyapp-deps/health" },
  { name: "mapreality", path: "/api/mapreality/health" },
  { name: "z-tide", path: "/api/z-tide/health" },
  { name: "lifebox", path: "/api/lifebox/health" },
  { name: "qchaingov", path: "/api/qchaingov/health" },
];

const SUB_OPENAPI = [
  { name: "qsign-v2", path: "/api/qsign/v2/openapi.json", title: "AEVION QSign v2" },
  { name: "quantum-shield", path: "/api/quantum-shield/openapi.json", title: "AEVION Quantum Shield" },
  { name: "qpaynet", path: "/api/qpaynet/openapi.json", title: "AEVION QPayNet" },
  { name: "qcontract", path: "/api/qcontract/openapi.json", title: "AEVION QContract" },
  { name: "healthai", path: "/api/healthai/openapi.json", title: "AEVION HealthAI" },
  { name: "qtradeoffline", path: "/api/qtradeoffline/openapi.json", title: "AEVION QTradeOffline" },
  { name: "qfusionai", path: "/api/qfusionai/openapi.json", title: "AEVION QFusionAI" },
  { name: "veilnetx", path: "/api/veilnetx/openapi.json", title: "AEVION VeilNetX" },
  // qgood/qmaskcard/qchaingov: dedicated MVP routers — /openapi.json not yet exposed there
  { name: "voice-of-earth", path: "/api/voice-of-earth/openapi.json", title: "AEVION Voice of Earth" },
  { name: "kids-ai-content", path: "/api/kids-ai-content/openapi.json", title: "AEVION Kids AI Content" },
  { name: "startup-exchange", path: "/api/startup-exchange/openapi.json", title: "AEVION Startup Exchange" },
  { name: "shadownet", path: "/api/shadownet/openapi.json", title: "AEVION ShadowNet" },
  { name: "deepsan", path: "/api/deepsan/openapi.json", title: "AEVION DeepSan" },
  { name: "qpersona", path: "/api/qpersona/openapi.json", title: "AEVION QPersona" },
  { name: "qlife", path: "/api/qlife/openapi.json", title: "AEVION QLife" },
  { name: "psyapp-deps", path: "/api/psyapp-deps/openapi.json", title: "AEVION PsyApp" },
  { name: "mapreality", path: "/api/mapreality/openapi.json", title: "AEVION MapReality" },
  { name: "z-tide", path: "/api/z-tide/openapi.json", title: "AEVION Z-Tide" },
  { name: "lifebox", path: "/api/lifebox/openapi.json", title: "AEVION LifeBox" },
];

/**
 * Probe a sibling endpoint on the same backend without going through the
 * external network. Uses an internal http call against the request's host so
 * Railway's per-deploy isolation still works.
 */
async function probe(
  req: Request,
  path: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: unknown; durationMs: number }> {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.protocol as string) ||
    "http";
  const host = req.headers.host || "127.0.0.1:4001";
  const url = `${proto}://${host}${path}`;
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await r.json();
    } catch {
      /* allow */
    }
    return { ok: r.ok, status: r.status, body, durationMs: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: { error: err instanceof Error ? err.message : String(err) },
      durationMs: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/aevion/health — single-call planetary monitor.
 *
 * Returns:
 *   {
 *     status: "ok" | "degraded" | "down",
 *     services: { [name]: { ok, status, durationMs, summary } },
 *     timestamp
 *   }
 *
 * Each sub-health probe runs in parallel with a 3-second timeout.
 */
aevionHubRouter.get("/health", async (req, res) => {
  const results = await Promise.all(
    SUB_HEALTH.map(async ({ name, path }) => {
      const { ok, status, body, durationMs } = await probe(req, path, 3_000);
      const summary =
        body && typeof body === "object" && body !== null
          ? extractSummary(body as Record<string, unknown>)
          : null;
      return { name, ok, status, durationMs, summary };
    }),
  );

  const healthy = results.filter((r) => r.ok).length;
  const total = results.length;
  let status: "ok" | "degraded" | "down";
  if (healthy === 0) status = "down";
  else if (healthy < total) status = "degraded";
  else status = "ok";

  // Cache lightly so dashboards can poll without hammering the cascade.
  res.setHeader("Cache-Control", "public, max-age=10");
  res.json({
    status,
    healthy,
    total,
    services: Object.fromEntries(results.map((r) => [r.name, r])),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/aevion/openapi.json — index of OpenAPI specs across the planet.
 *
 * Each entry carries the module name, a short description, and a link to
 * its self-served spec. Consumers (Postman, Stoplight, openapi-generator)
 * can crawl this index to build per-product SDKs.
 */
aevionHubRouter.get("/openapi.json", (req, res) => {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.protocol as string) ||
    "http";
  const host = req.headers.host || "127.0.0.1:4001";
  const origin = `${proto}://${host}`;

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    aevion: {
      name: "AEVION Planet — API Index",
      version: "1.0.0",
      description:
        "Multi-module IP-protection platform. Each entry below points at a self-served OpenAPI 3.0 spec for a single product.",
      modules: SUB_OPENAPI.map((m) => ({
        name: m.name,
        title: m.title,
        spec: `${origin}${m.path}`,
      })),
      services: SUB_HEALTH.map((s) => ({
        name: s.name,
        health: `${origin}${s.path}`,
      })),
      sdk: {
        npm: [
          "@aevion/qsign-client",
          "@aevion/qshield-client",
          "@aevion/pipeline-client",
          "@aevion/qright-client",
          "@aevion/planet-client",
          "@aevion/bureau-client",
        ],
        docs: "https://aevion.app/docs/sdk",
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/aevion/version — quick build-info probe (process metadata only,
 * no DB). Useful for "what's deployed?" dashboard tiles.
 */
/** GET /api/aevion/sitemap.xml — platform-wide XML sitemap index. */
aevionHubRouter.get("/sitemap.xml", (req, res) => {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";
  const modules = [
    "/qright", "/qsign", "/bureau", "/qcoreai", "/cyberchess",
    "/planet", "/awards", "/bank", "/healthai", "/qtrade", "/quantum-shield",
    "/qcontract", "/qpaynet", "/smeta-trainer", "/build", "/devhub",
  ];
  const urls = modules
    .map((p) => `  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  const etag = `W/"sitemap-hub-${modules.length}-${Buffer.byteLength(body)}"`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("ETag", etag);
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.send(body);
});

/**
 * GET /api/aevion/catalog — unified module catalog.
 *
 * Single call returning every module in the AEVION ecosystem (from
 * projects.ts) enriched with the frontend URL, OpenGraph image URL,
 * health-probe URL, OpenAPI spec URL (when available), and status tags.
 *
 * Designed for partners building dashboards / discovery widgets that need
 * the whole AEVION surface in one HTTP round-trip.
 *
 * Filters:
 *   ?status=mvp|working|in_progress|planning|idea  — comma-separated allowed
 *   ?tag=ai,privacy  — comma-separated; matches any
 *   ?kind=product|experiment
 */
aevionHubRouter.get("/catalog", (req, res) => {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aevion.app").replace(/\/+$/, "");
  const apiBase = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/+$/, "");

  const statusFilter = String(req.query.status ?? "").trim().toLowerCase();
  const tagFilter = String(req.query.tag ?? "").trim().toLowerCase();
  const kindFilter = String(req.query.kind ?? "").trim().toLowerCase();

  const allowedStatuses = statusFilter ? new Set(statusFilter.split(",").map((s) => s.trim())) : null;
  const allowedTags = tagFilter ? new Set(tagFilter.split(",").map((s) => s.trim())) : null;
  const allowedKinds = kindFilter ? new Set(kindFilter.split(",").map((s) => s.trim())) : null;

  const healthIndex = new Map(SUB_HEALTH.map((h) => [h.name, h.path]));
  const openapiIndex = new Map(SUB_OPENAPI.map((o) => [o.name, o.path]));

  // Pre-compute tag-overlap relations across ALL projects (not just filtered)
  // so /qpersona always shows related modules from full catalog, not just the
  // current filter slice.
  function deriveRelated(self: typeof projects[number]): { id: string; name: string; overlap: number }[] {
    const selfTags = (Array.isArray(self.tags) ? self.tags : []).map((t) => String(t).toLowerCase());
    if (selfTags.length === 0) return [];
    const selfSet = new Set(selfTags);
    return projects
      .filter((p) => p.id !== self.id)
      .map((p) => {
        const tags = (Array.isArray(p.tags) ? p.tags : []).map((t) => String(t).toLowerCase());
        const overlap = tags.filter((t) => selfSet.has(t)).length;
        return { id: String(p.id), name: String(p.name), overlap };
      })
      .filter((r) => r.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3);
  }

  const items = projects
    .filter((p) => {
      if (allowedStatuses && !allowedStatuses.has(String(p.status))) return false;
      if (allowedKinds && !allowedKinds.has(String(p.kind))) return false;
      if (allowedTags) {
        const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
        if (!tags.some((t) => allowedTags.has(t))) return false;
      }
      return true;
    })
    .map((p) => {
      const id = String(p.id);
      const healthPath = healthIndex.get(id);
      const openapiPath = openapiIndex.get(id);
      return {
        id,
        code: p.code,
        name: p.name,
        description: p.description,
        kind: p.kind,
        status: p.status,
        priority: p.priority,
        tags: p.tags,
        frontend: `${site}/${id}`,
        ogImage: `${site}/${id}/opengraph-image`,
        health: healthPath ? `${apiBase}${healthPath}` : null,
        openapi: openapiPath ? `${apiBase}${openapiPath}` : null,
        waitlist: healthPath ? `${apiBase}${healthPath.replace(/\/health$/, "/waitlist")}` : null,
        status_url: healthPath ? `${apiBase}${healthPath.replace(/\/health$/, "/status")}` : null,
        relatedModules: deriveRelated(p),
      };
    });

  // Optional field projection — partners can ask for a lean subset.
  // Whitelist enforced so unknown keys silently drop (forward-compat).
  const ALLOWED_FIELDS = new Set([
    "id", "code", "name", "description", "kind", "status", "priority", "tags",
    "frontend", "ogImage", "health", "openapi", "waitlist", "status_url", "relatedModules",
  ]);
  const fieldsFilter = String(req.query.fields ?? "").trim();
  const projectedItems = fieldsFilter
    ? items.map((it) => {
        const out: Record<string, unknown> = {};
        for (const f of fieldsFilter.split(",").map((s) => s.trim()).filter(Boolean)) {
          if (ALLOWED_FIELDS.has(f) && f in it) {
            out[f] = (it as Record<string, unknown>)[f];
          }
        }
        return out;
      })
    : items;

  res.setHeader("Cache-Control", "public, max-age=120");

  const format = String(req.query.format ?? "json").trim().toLowerCase();
  if (format === "csv") {
    // RFC 4180 CSV — fields with comma/quote/newline get quoted; embedded
    // quotes get doubled. Stable column order for spreadsheet import.
    const esc = (v: unknown): string => {
      const s = v == null ? "" : Array.isArray(v) ? v.join(";") : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cols = [
      "id", "code", "name", "kind", "status", "priority", "tags",
      "frontend", "ogImage", "health", "openapi", "waitlist", "status_url",
      "relatedModules", "description",
    ];
    const lines = [cols.join(",")];
    for (const it of items) {
      const related = (it.relatedModules || []).map((r) => `${r.id}(${r.overlap})`).join(";");
      lines.push([
        esc(it.id), esc(it.code), esc(it.name), esc(it.kind), esc(it.status),
        esc(it.priority), esc(it.tags), esc(it.frontend), esc(it.ogImage),
        esc(it.health), esc(it.openapi), esc(it.waitlist), esc(it.status_url),
        esc(related), esc(it.description),
      ].join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="aevion-catalog.csv"`);
    return res.send(lines.join("\r\n") + "\r\n");
  }

  if (format === "md" || format === "markdown") {
    const escMd = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const filterLabel =
      statusFilter || tagFilter || kindFilter
        ? ` (filtered: ${[
            statusFilter && `status=${statusFilter}`,
            tagFilter && `tag=${tagFilter}`,
            kindFilter && `kind=${kindFilter}`,
          ].filter(Boolean).join(", ")})`
        : "";
    const head =
      `# AEVION Module Catalog\n\n` +
      `**Generated:** ${new Date().toISOString()}  \n` +
      `**Total:** ${items.length} modules${filterLabel}\n\n`;
    const tableHead =
      `| Code | Name | Status | Kind | Tags | Frontend | OpenAPI |\n` +
      `|------|------|--------|------|------|----------|---------|\n`;
    const rows = items.map((it) => {
      const tags = Array.isArray(it.tags) ? it.tags.join(", ") : "";
      const fe = `[link](${it.frontend})`;
      const oa = it.openapi ? `[spec](${it.openapi})` : "—";
      return `| \`${escMd(it.code)}\` | ${escMd(it.name)} | ${escMd(it.status)} | ${escMd(it.kind)} | ${escMd(tags)} | ${fe} | ${oa} |`;
    }).join("\n");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="aevion-catalog.md"`);
    return res.send(head + tableHead + rows + "\n");
  }

  res.json({
    total: projectedItems.length,
    filters: {
      status: statusFilter || null,
      tag: tagFilter || null,
      kind: kindFilter || null,
      fields: fieldsFilter || null,
    },
    items: projectedItems,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/aevion/catalog/:id — single-module deep lookup.
 *
 * Returns the same enriched item shape as /catalog (frontend, OG, OpenAPI,
 * waitlist, status URLs, related modules), or 404 if unknown id.
 */
aevionHubRouter.get("/catalog/:id", (req, res) => {
  const id = String(req.params.id || "").trim().toLowerCase();
  if (!id) return res.status(400).json({ error: "id-required" });
  const p = projects.find((proj) => String(proj.id).toLowerCase() === id);
  if (!p) return res.status(404).json({ error: "module-not-found", id });

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aevion.app").replace(/\/+$/, "");
  const apiBase = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/+$/, "");

  const healthIndex = new Map(SUB_HEALTH.map((h) => [h.name, h.path]));
  const openapiIndex = new Map(SUB_OPENAPI.map((o) => [o.name, o.path]));
  const healthPath = healthIndex.get(String(p.id));
  const openapiPath = openapiIndex.get(String(p.id));

  const selfTags = (Array.isArray(p.tags) ? p.tags : []).map((t) => String(t).toLowerCase());
  const selfSet = new Set(selfTags);
  const relatedModules = projects
    .filter((q) => q.id !== p.id)
    .map((q) => {
      const tags = (Array.isArray(q.tags) ? q.tags : []).map((t) => String(t).toLowerCase());
      const overlap = tags.filter((t) => selfSet.has(t)).length;
      return { id: String(q.id), name: String(q.name), overlap };
    })
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5);

  res.setHeader("Cache-Control", "public, max-age=120");
  res.json({
    id: String(p.id),
    code: p.code,
    name: p.name,
    description: p.description,
    kind: p.kind,
    status: p.status,
    priority: p.priority,
    tags: p.tags,
    frontend: `${site}/${p.id}`,
    ogImage: `${site}/${p.id}/opengraph-image`,
    health: healthPath ? `${apiBase}${healthPath}` : null,
    openapi: openapiPath ? `${apiBase}${openapiPath}` : null,
    waitlist: healthPath ? `${apiBase}${healthPath.replace(/\/health$/, "/waitlist")}` : null,
    status_url: healthPath ? `${apiBase}${healthPath.replace(/\/health$/, "/status")}` : null,
    relatedModules,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/aevion/registry-stats — taxonomy summary of the module registry.
 *
 * Aggregates from projects.ts:
 *   byStatus  — { mvp: 6, planning: 12, idea: 9, ... }
 *   byKind    — { product: 23, service: 3, experiment: 4 }
 *   byTag     — top-20 tags by usage count [{ tag, count }]
 *   total     — total module count
 *
 * Used for dashboard tiles, taxonomy widgets, and pre-flight checks.
 * Cached 5 minutes.
 */
aevionHubRouter.get("/registry-stats", (_req, res) => {
  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const tagCount = new Map<string, number>();

  for (const p of projects) {
    const status = String(p.status || "unknown");
    const kind = String(p.kind || "unknown");
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    if (Array.isArray(p.tags)) {
      for (const t of p.tags) {
        const tag = String(t).toLowerCase();
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }
    }
  }

  const byTag = Array.from(tagCount.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 20);

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    total: projects.length,
    byStatus,
    byKind,
    byTag,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/aevion/badges/:moduleId.svg — shields.io-style status badge.
 *
 * Drop into README/docs:
 *   ![AEVION QPersona](https://api.aevion.app/api/aevion/badges/qpersona.svg)
 *
 * Status-aware colors: mvp/launched=green, in_progress=amber, planning=blue,
 * research=violet, idea=gray.
 */
aevionHubRouter.get("/badges/:moduleId.svg", (req, res) => {
  const id = String(req.params.moduleId || "").trim().toLowerCase();
  const p = projects.find((proj) => String(proj.id).toLowerCase() === id);

  const STATUS_COLORS: Record<string, string> = {
    mvp: "#10b981",
    launched: "#10b981",
    working: "#10b981",
    in_progress: "#f59e0b",
    planning: "#3b82f6",
    research: "#8b5cf6",
    idea: "#64748b",
    unknown: "#64748b",
  };

  const label = "AEVION";
  const status = p ? String(p.status || "unknown") : "not-found";
  const value = p ? `${p.code || p.id} · ${status}` : "module not found";
  const color = STATUS_COLORS[status] ?? "#64748b";

  // ~6.5px per char heuristic for shields.io look-alike width
  const charW = 6.5;
  const padX = 8;
  const labelW = Math.ceil(label.length * charW + padX * 2);
  const valueW = Math.ceil(value.length * charW + padX * 2);
  const totalW = labelW + valueW;
  const h = 20;

  function esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
    );
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}" role="img" aria-label="${esc(label)}: ${esc(value)}">
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".15"/>
    <stop offset="1" stop-opacity=".15"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="${h}" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${h}" fill="#0f172a"/>
    <rect x="${labelW}" width="${valueW}" height="${h}" fill="${color}"/>
    <rect width="${totalW}" height="${h}" fill="url(#g)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="14">${esc(label)}</text>
    <text x="${labelW + valueW / 2}" y="14">${esc(value)}</text>
  </g>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(p ? 200 : 404).send(svg);
});

aevionHubRouter.get("/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    service: "aevion-hub",
    node: process.version,
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    env: process.env.NODE_ENV || "development",
    release: process.env.AEVION_RELEASE || null,
    commit: process.env.AEVION_COMMIT_SHA || null,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/aevion/stats — extended platform-wide statistics snapshot.
 *
 * Differs from /registry-stats by adding:
 *   - byKind grouped counters (kind is the AEVION "category")
 *   - recentActivity — top-N most recently touched modules (by updatedAt
 *     when present, falling back to createdAt) with status/kind/priority
 *   - coverage — share of registry modules with a /health probe and with
 *     a self-served /openapi.json (so we can spot modules missing wiring)
 *   - priorityBuckets — counts grouped by priority tier
 *
 * Designed for dashboard "platform overview" tiles that need one cheap call.
 * Cached 5 minutes (matches /registry-stats).
 *
 * Query:
 *   ?recent=10  — how many entries to return in recentActivity (1..50, default 10)
 */
aevionHubRouter.get("/stats", (req, res) => {
  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const tagCount = new Map<string, number>();

  for (const p of projects) {
    const status = String(p.status || "unknown");
    const kind = String(p.kind || "unknown");
    const prio = p.priority == null ? "unknown" : String(p.priority);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    byPriority[prio] = (byPriority[prio] ?? 0) + 1;
    if (Array.isArray(p.tags)) {
      for (const t of p.tags) {
        const tag = String(t).toLowerCase();
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }
    }
  }

  const topTags = Array.from(tagCount.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 20);

  // Coverage: how many modules have a /health probe wired in SUB_HEALTH,
  // and how many have a self-served /openapi.json wired in SUB_OPENAPI.
  const healthIds = new Set(SUB_HEALTH.map((h) => h.name));
  const openapiIds = new Set(SUB_OPENAPI.map((o) => o.name));
  let healthCovered = 0;
  let openapiCovered = 0;
  for (const p of projects) {
    if (healthIds.has(String(p.id))) healthCovered += 1;
    if (openapiIds.has(String(p.id))) openapiCovered += 1;
  }

  const total = projects.length;
  const pct = (n: number): number => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

  // Recent activity — pick the most recently touched modules. Falls back to
  // createdAt when updatedAt is absent, then to module id for deterministic
  // tie-breaking. Clamp `recent` to [1..50].
  const recentParam = Number.parseInt(String(req.query.recent ?? "10"), 10);
  const recentN = Number.isFinite(recentParam) ? Math.max(1, Math.min(50, recentParam)) : 10;
  const recentActivity = [...projects]
    .map((p) => {
      const updated = (p as { updatedAt?: unknown }).updatedAt;
      const created = (p as { createdAt?: unknown }).createdAt;
      const ts = typeof updated === "string" && updated
        ? updated
        : typeof created === "string" && created
        ? created
        : "";
      return {
        id: String(p.id),
        code: p.code,
        name: p.name,
        status: p.status,
        kind: p.kind,
        priority: p.priority,
        touchedAt: ts || null,
      };
    })
    .sort((a, b) => {
      const aT = a.touchedAt ?? "";
      const bT = b.touchedAt ?? "";
      if (aT !== bT) return bT.localeCompare(aT);
      return a.id.localeCompare(b.id);
    })
    .slice(0, recentN);

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    total,
    byStatus,
    byKind,
    byPriority,
    topTags,
    coverage: {
      health: { count: healthCovered, total, percent: pct(healthCovered) },
      openapi: { count: openapiCovered, total, percent: pct(openapiCovered) },
    },
    recentActivity,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/aevion/module-of-the-day — deterministic daily pick.
 *
 * Picks one module per UTC day using day-of-year mod registry-size, so
 * every consumer hitting this endpoint on the same day gets the same
 * module. Useful for "featured today" widgets on the landing / dashboard.
 *
 * The ordering is stable: projects are sorted by id before indexing,
 * so adding a new module mid-cycle doesn't reshuffle history.
 *
 * Response mirrors /catalog/:id (frontend, health, openapi, related)
 * plus a `tomorrow` preview pointer so widgets can show a teaser.
 *
 * Query:
 *   ?date=YYYY-MM-DD — override "today" (clamped to a valid date; useful
 *                       for testing and for back-fill on archived posts).
 */
aevionHubRouter.get("/module-of-the-day", (req, res) => {
  if (projects.length === 0) {
    return res.status(503).json({ error: "registry-empty" });
  }

  const dateParam = String(req.query.date ?? "").trim();
  const now = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? new Date(`${dateParam}T00:00:00Z`)
    : new Date();
  // Guard against invalid date strings ("9999-99-99" parses to NaN)
  const baseDate = Number.isFinite(now.getTime()) ? now : new Date();

  // UTC day-of-year [0..365]
  const startOfYear = Date.UTC(baseDate.getUTCFullYear(), 0, 1);
  const today = Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate());
  const dayOfYear = Math.floor((today - startOfYear) / 86_400_000);

  // Stable ordering — sort by id, not by registry order, so a re-order in
  // projects.ts doesn't reshuffle the daily rotation history.
  const ordered = [...projects].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );

  const idx = ((dayOfYear % ordered.length) + ordered.length) % ordered.length;
  const tomorrowIdx = (idx + 1) % ordered.length;
  const p = ordered[idx]!;
  const next = ordered[tomorrowIdx]!;

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aevion.app").replace(/\/+$/, "");
  const apiBase = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/+$/, "");

  const healthIndex = new Map(SUB_HEALTH.map((h) => [h.name, h.path]));
  const openapiIndex = new Map(SUB_OPENAPI.map((o) => [o.name, o.path]));
  const healthPath = healthIndex.get(String(p.id));
  const openapiPath = openapiIndex.get(String(p.id));

  // Tag-overlap related, capped to 3 — same logic as /catalog item.
  const selfTags = (Array.isArray(p.tags) ? p.tags : []).map((t) => String(t).toLowerCase());
  const selfSet = new Set(selfTags);
  const relatedModules = projects
    .filter((q) => q.id !== p.id)
    .map((q) => {
      const tags = (Array.isArray(q.tags) ? q.tags : []).map((t) => String(t).toLowerCase());
      const overlap = tags.filter((t) => selfSet.has(t)).length;
      return { id: String(q.id), name: String(q.name), overlap };
    })
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3);

  // Cache until the next UTC midnight so dashboards rotate cleanly.
  const msUntilMidnight = 86_400_000 - (Date.now() - Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
  ));
  const maxAge = Math.max(60, Math.min(86_400, Math.floor(msUntilMidnight / 1000)));
  res.setHeader("Cache-Control", `public, max-age=${maxAge}`);

  res.json({
    date: `${baseDate.getUTCFullYear()}-${String(baseDate.getUTCMonth() + 1).padStart(2, "0")}-${String(baseDate.getUTCDate()).padStart(2, "0")}`,
    dayOfYear,
    registrySize: ordered.length,
    module: {
      id: String(p.id),
      code: p.code,
      name: p.name,
      description: p.description,
      kind: p.kind,
      status: p.status,
      priority: p.priority,
      tags: p.tags,
      frontend: `${site}/${p.id}`,
      ogImage: `${site}/${p.id}/opengraph-image`,
      health: healthPath ? `${apiBase}${healthPath}` : null,
      openapi: openapiPath ? `${apiBase}${openapiPath}` : null,
      waitlist: healthPath ? `${apiBase}${healthPath.replace(/\/health$/, "/waitlist")}` : null,
      status_url: healthPath ? `${apiBase}${healthPath.replace(/\/health$/, "/status")}` : null,
      relatedModules,
    },
    tomorrow: { id: String(next.id), code: next.code, name: next.name },
    generatedAt: new Date().toISOString(),
  });
});

// GET /api/aevion/sdks — published AEVION SDK packages on npm.
// Public consumer-facing endpoint: integration docs, install commands,
// links to npmjs.com. Single source of truth so frontend SDK pages,
// docs site, and partner integrations agree on what's published.
//
// Enriches each entry with live npm stats (last-week downloads +
// lastPublished timestamp). Stats are cached in-memory for 1 hour
// since npm download counts update once daily — no need to hammer.
// If the npm API is slow or down, we serve the static fallback so the
// endpoint stays available; stats fields just become null.

interface SdkStats {
  downloadsLastWeek: number | null;
  lastPublished: string | null;
  fetchedAt: string;
}

const SDK_STATS_CACHE = new Map<string, { stats: SdkStats; expiresAt: number }>();
const SDK_STATS_TTL_MS = 3600 * 1000; // 1h

async function fetchSdkStats(pkgName: string): Promise<SdkStats> {
  const cached = SDK_STATS_CACHE.get(pkgName);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.stats;

  const stats: SdkStats = { downloadsLastWeek: null, lastPublished: null, fetchedAt: new Date().toISOString() };
  const enc = encodeURIComponent(pkgName);

  // Two parallel requests, 5s each — Railway egress can be slow on the
  // full /<pkg> registry payload (~12KB JSON), and some npm CDN edges
  // are picky about the User-Agent header for non-browser clients.
  const ac = AbortSignal.timeout(5000);
  const fetchOpts = {
    signal: ac,
    headers: {
      "Accept": "application/json",
      "User-Agent": "aevion-hub/1.0 (+https://github.com/Dossymbek281078/AEVION)",
    },
  };
  const [dlRes, regRes] = await Promise.allSettled([
    fetch(`https://api.npmjs.org/downloads/point/last-week/${enc}`, fetchOpts),
    fetch(`https://registry.npmjs.org/${enc}`, fetchOpts),
  ]);

  if (dlRes.status === "fulfilled" && dlRes.value.ok) {
    try {
      const j = await dlRes.value.json() as { downloads?: number };
      if (typeof j.downloads === "number") stats.downloadsLastWeek = j.downloads;
    } catch { /* leave null */ }
  }
  if (regRes.status === "fulfilled" && regRes.value.ok) {
    try {
      const j = await regRes.value.json() as { modified?: string };
      if (typeof j.modified === "string") stats.lastPublished = j.modified;
    } catch { /* leave null */ }
  }

  // Only cache successful fetches for the full hour. If npm was slow this
  // call, cache for 60s so we retry sooner instead of serving null for 1h.
  const ok = stats.downloadsLastWeek !== null && stats.lastPublished !== null;
  SDK_STATS_CACHE.set(pkgName, { stats, expiresAt: now + (ok ? SDK_STATS_TTL_MS : 60_000) });
  return stats;
}

aevionHubRouter.get("/sdks", async (req, res) => {
  const sdks = [
    {
      id: "fintech-sdk",
      name: "@aevion-io/fintech-sdk",
      version: "0.2.0",
      description: "TypeScript client for the AEVION fintech ecosystem (QGood, QMaskCard, VeilNetX, Z-Tide, QChainGov, QPayNet) + webhook signing helpers.",
      install: "npm install @aevion-io/fintech-sdk",
      registry: "https://www.npmjs.com/package/@aevion-io/fintech-sdk",
      tarball: "https://registry.npmjs.org/@aevion-io/fintech-sdk/-/fintech-sdk-0.2.0.tgz",
      modules: ["qgood", "qmaskcard", "veilnetx-ledger", "ztide", "qchaingov", "qpaynet-embedded"],
      license: "MIT",
    },
    {
      id: "catalog-client",
      name: "@aevion-io/catalog-client",
      version: "0.8.1",
      description: "TypeScript client for the AEVION Hub catalog API + 9 namespaced sub-clients (QStore, QLearn, QEvents, DevHub, Planet, QCoreAI, Multichat, QMedia, Coach).",
      install: "npm install @aevion-io/catalog-client",
      registry: "https://www.npmjs.com/package/@aevion-io/catalog-client",
      tarball: "https://registry.npmjs.org/@aevion-io/catalog-client/-/catalog-client-0.8.1.tgz",
      modules: ["qstore", "qlearn", "qevents", "devhub", "planet", "qcoreai", "multichat-engine", "qmedia", "coach"],
      license: "MIT",
    },
    {
      id: "qpaynet-client",
      name: "@dosymbek/qpaynet-client",
      version: "1.0.4",
      description: "TypeScript client for AEVION QPayNet — embedded payment infrastructure with HMAC webhooks, idempotent transfers, merchant keys, payment links.",
      install: "npm install @dosymbek/qpaynet-client",
      registry: "https://www.npmjs.com/package/@dosymbek/qpaynet-client",
      tarball: "https://registry.npmjs.org/@dosymbek/qpaynet-client/-/qpaynet-client-1.0.4.tgz",
      modules: ["qpaynet-embedded"],
      license: "Apache-2.0",
    },
    {
      id: "qcoreai-client",
      name: "@dosymbek/qcoreai-client",
      version: "1.0.0",
      description: "TypeScript client for AEVION QCoreAI multi-agent pipeline — sync/streaming chat, agents, prompts, threading, batch runs, export hub.",
      install: "npm install @dosymbek/qcoreai-client",
      registry: "https://www.npmjs.com/package/@dosymbek/qcoreai-client",
      tarball: "https://registry.npmjs.org/@dosymbek/qcoreai-client/-/qcoreai-client-1.0.0.tgz",
      modules: ["qcoreai"],
      license: "Apache-2.0",
    },
  ];

  // ?stats=0 disables enrichment (cheap path for orchestrator smokes).
  const wantStats = String(req.query.stats ?? "1") !== "0";

  let enriched: Array<typeof sdks[number] & Partial<SdkStats>> = sdks;
  let totalDownloadsLastWeek: number | null = null;

  if (wantStats) {
    const stats = await Promise.all(sdks.map((s) => fetchSdkStats(s.name).catch(() => null)));
    enriched = sdks.map((sdk, i) => ({
      ...sdk,
      downloadsLastWeek: stats[i]?.downloadsLastWeek ?? null,
      lastPublished: stats[i]?.lastPublished ?? null,
    }));
    totalDownloadsLastWeek = stats.reduce(
      (sum, s) => (sum === null ? null : (s?.downloadsLastWeek ?? 0) + sum),
      0 as number | null,
    );
  }

  res.set("Cache-Control", "public, max-age=300");
  res.json({
    total: sdks.length,
    sdks: enriched,
    totalDownloadsLastWeek,
    docs: "https://github.com/Dossymbek281078/AEVION",
    generatedAt: new Date().toISOString(),
  });
});

function extractSummary(body: Record<string, unknown>): Record<string, unknown> {
  // Pull a few well-known fields if present, ignore the rest. Keeps the
  // composite payload small even when sub-health surfaces are noisy.
  const keys = [
    "status",
    "service",
    "version",
    "totalRecords",
    "shieldRecords",
    "activeRecords",
    "distributedRecords",
    "counts",
    "activeKeys",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in body) out[k] = body[k];
  }
  return out;
}
