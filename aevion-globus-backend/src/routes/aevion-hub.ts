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
    total: items.length,
    filters: {
      status: statusFilter || null,
      tag: tagFilter || null,
      kind: kindFilter || null,
    },
    items,
    generatedAt: new Date().toISOString(),
  });
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
