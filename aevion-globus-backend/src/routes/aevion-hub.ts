/**
 * AEVION Hub — composite cross-product endpoints.
 *
 * Aggregates health and OpenAPI specs from every planetary module so consumers
 * can monitor the whole stack (qsign + qshield + qright + pipeline + planet)
 * with a single GET. The hub does not itself touch DB tables — it just
 * cascades downstream calls.
 */

import { Router, type Request } from "express";
import { applyEtag } from "../lib/ogEtag";

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
];

const SUB_OPENAPI = [
  { name: "qsign-v2", path: "/api/qsign/v2/openapi.json", title: "AEVION QSign v2" },
  { name: "quantum-shield", path: "/api/quantum-shield/openapi.json", title: "AEVION Quantum Shield" },
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
        docs: "https://aevion.com/docs/sdk",
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/aevion/sitemap.xml — sitemap-index aggregating every module's
 * own sitemap. Per sitemaps.org, search engines that hit a sitemapindex
 * file fan out to each <sitemap><loc> child, so this single URL gets all
 * 7 surfaces indexed without listing every URL twice.
 *
 * Use case: a single Sitemap: directive in robots.txt + Google/Bing
 * Search Console submission covers the whole platform.
 */
aevionHubRouter.get("/sitemap.xml", (req, res) => {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.protocol as string) ||
    "https";
  const host = req.headers.host || "aevion.tech";
  const origin = `${proto}://${host}`;
  const today = new Date().toISOString().slice(0, 10);

  const modules: Array<{ name: string; path: string }> = [
    { name: "modules", path: "/api/modules/sitemap.xml" },
    { name: "bureau", path: "/api/bureau/sitemap.xml" },
    { name: "awards", path: "/api/awards/sitemap.xml" },
    { name: "pipeline", path: "/api/pipeline/sitemap.xml" },
    { name: "qright", path: "/api/qright/sitemap.xml" },
    { name: "quantum-shield", path: "/api/quantum-shield/sitemap.xml" },
    { name: "planet", path: "/api/planet/sitemap.xml" },
  ];

  function esc(s: string): string {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  const items = modules
    .map(
      (m) => `  <sitemap>
    <loc>${esc(origin + m.path)}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (applyEtag(req, res, `aevion-index-${modules.length}-${today}`, { prefix: "sitemap", maxAgeSec: 600 })) return;
  res.send(xml);
});

/**
 * GET /api/aevion/robots.txt — robots.txt with the Sitemap: directive
 * pointing at the sitemap-index. Frontend can either proxy this verbatim
 * or expose its own /robots.txt that references the same canonical URL.
 *
 * No path-level Disallow rules; per-route opt-outs (admin/, api-backend/)
 * are handled by Next.js metadata in app/robots.ts.
 */
aevionHubRouter.get("/robots.txt", (req, res) => {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.protocol as string) ||
    "https";
  const host = req.headers.host || "aevion.tech";
  const origin = `${proto}://${host}`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /api-backend/",
      "",
      `Sitemap: ${origin}/api/aevion/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

/**
 * GET /api/aevion/version — quick build-info probe (process metadata only,
 * no DB). Useful for "what's deployed?" dashboard tiles.
 */
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
