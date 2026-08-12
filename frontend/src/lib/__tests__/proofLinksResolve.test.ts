import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guard: a page that asks someone for money may not cite a link that 404s.
// 2026-08-12.
//
// The daily claims audit had been failing on "каждая ссылка-доказательство
// отвечает 200" for days. Checked by hand against prod:
//
//   /transparency                → 404   (7 links: "Live health-board",
//                                         "Transparency board" on acquire,
//                                         investor, partner, pilot)
//   /api/aevion/registry         → 404   (no such route; cited on /partner as
//                                         a clickable "GET /api/aevion/registry"
//                                         and printed as the source under the
//                                         "Modules tracked" counter on /acquire)
//
// Neither ever existed. `/transparency` falls into the app/[id] catch-all,
// which calls notFound() for anything not in the module registry — so the
// link renders fine, looks deliberate, and dead-ends the reader. The real
// pages are /status (live health board) and /launch-status; the real registry
// route is /api/aevion/catalog, and the counter's actual source is
// /api/aevion/stats.
//
// The raw Railway host is pinned here too: an investor-facing page that links
// to aevion-production-a70c.up.railway.app both leaks internal hosting and
// skips the /api-backend proxy the rest of the frontend goes through.

const APP = path.resolve(__dirname, "../../app");
const BACKEND_HUB = path.resolve(
  __dirname,
  "../../../../aevion-globus-backend/src/routes/aevion-hub.ts",
);

/** Pages that address a buyer, partner, investor, journalist or pilot lead. */
const AUDIENCE_PAGES = ["acquire", "partner", "investor", "pilot", "press", "pitch"];

const RAW_BACKEND_HOST = "aevion-production-a70c.up.railway.app";

function tsxFilesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? tsxFilesUnder(path.join(dir, e.name))
        : e.name.endsWith(".tsx") || e.name.endsWith(".ts")
          ? [path.join(dir, e.name)]
          : [],
    );
}

const AUDIENCE_FILES = AUDIENCE_PAGES.flatMap((p) => tsxFilesUnder(path.join(APP, p)));

/**
 * Files that make a URL without being a page: route handlers and the
 * metadata conventions. /icon and /apple-icon on /press are served by
 * app/icon.tsx and app/apple-icon.tsx and answer 200 on prod — checked by
 * hand, because the first cut of this guard called them dead.
 */
const NON_PAGE_ROUTE_FILES = [
  "route.ts",
  "route.tsx",
  "icon.tsx",
  "apple-icon.tsx",
  "opengraph-image.tsx",
  "twitter-image.tsx",
  "manifest.ts",
  "robots.ts",
  "sitemap.ts",
];

/**
 * Every route the app router actually serves from its own directory, e.g.
 * "/status". Dynamic segments are kept as-is: a link to a literal path only
 * counts as live when a real directory backs it, because the top-level
 * app/[id] catch-all notFound()s anything outside the module registry — which
 * is exactly how /transparency shipped looking valid.
 */
function realRoutes(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string, route: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) {
        if (e.name === "page.tsx") out.add(route === "" ? "/" : route);
        else if (NON_PAGE_ROUTE_FILES.includes(e.name)) {
          out.add(`${route}/${e.name.replace(/\.tsx?$/, "")}`);
        }
        continue;
      }
      // Only app/api holds route handlers; /constitution/api and /payments/api
      // are ordinary pages, and skipping them made the first sweep report
      // three dead links that answer 200.
      if (e.name.startsWith("_") || e.name === "__tests__") continue;
      if (e.name === "api" && route === "") continue;
      // Route groups "(marketing)" do not appear in the URL.
      const seg = e.name.startsWith("(") && e.name.endsWith(")") ? "" : `/${e.name}`;
      walk(path.join(dir, e.name), route + seg);
    }
  };
  walk(APP, "");
  return out;
}

/** Routes mounted under /api/aevion, read from the router itself. */
function aevionApiRoutes(): Set<string> {
  const src = fs.readFileSync(BACKEND_HUB, "utf8");
  const out = new Set<string>();
  for (const m of src.matchAll(/aevionHubRouter\.(?:get|post|put|delete)\(\s*"([^"]+)"/g)) {
    out.add(`/api/aevion${m[1]}`);
  }
  return out;
}

/**
 * Internal hrefs and cited paths, with the line they sit on. Absolute links to
 * our own domain count too: /partner linked "Transparency board" to
 * https://aevion.app/transparency, which is the same 404 written the long way.
 */
function citedPaths(source: string): { p: string; line: number }[] {
  const out: { p: string; line: number }[] = [];
  source.split("\n").forEach((text, i) => {
    for (const m of text.matchAll(/(?:href=|sub=)"(\/[^"#?]*)"/g)) {
      out.push({ p: m[1], line: i + 1 });
    }
    // Both the clickable form and the address printed as plain text: the PDF
    // briefs told an investor to open aevion.app/transparency by typing it.
    for (const m of text.matchAll(/(?:https:\/\/)?aevion\.app(\/[^"'\s#?)<·]*)/g)) {
      const p = m[1].replace(/[.,;:]+$/, "");
      if (p !== "/") out.push({ p, line: i + 1 });
    }
  });
  return out;
}

const ROUTES = realRoutes();
const API_ROUTES = aevionApiRoutes();

describe("proof links on audience-facing pages resolve", () => {
  test("the guard reads both sources of truth", () => {
    // Proof the matchers are not vacuous — an empty set would pass everything.
    expect(ROUTES.has("/status")).toBe(true);
    expect(ROUTES.has("/launch-status")).toBe(true);
    expect(ROUTES.has("/transparency")).toBe(false);
    // Metadata conventions count as routes — prod answers 200 for both.
    expect(ROUTES.has("/icon")).toBe(true);
    expect(ROUTES.has("/apple-icon")).toBe(true);
    expect(API_ROUTES.has("/api/aevion/catalog")).toBe(true);
    expect(API_ROUTES.has("/api/aevion/stats")).toBe(true);
    expect(API_ROUTES.has("/api/aevion/registry")).toBe(false);
    expect(AUDIENCE_FILES.length).toBeGreaterThan(10);
  });

  test("the guard catches every shape that shipped", () => {
    // Relative link — /acquire, /partner, /investor, /pilot.
    expect(citedPaths('<Link href="/transparency" style={btnGhost}>').map((c) => c.p)).toEqual([
      "/transparency",
    ]);
    // Absolute link to our own domain — /partner evidence card.
    expect(
      citedPaths('{ label: "Transparency board", href: "https://aevion.app/transparency", note:')
        .map((c) => c.p),
    ).toEqual(["/transparency"]);
    // Address printed as text for someone to type — the PDF briefs.
    expect(
      citedPaths("<strong>aevion.app/transparency</strong> — health-board").map((c) => c.p),
    ).toEqual(["/transparency"]);
    // The caption under a counter.
    expect(citedPaths('sub="/api/aevion/registry"').map((c) => c.p)).toEqual([
      "/api/aevion/registry",
    ]);
    // And it does not invent findings out of ordinary prose.
    expect(citedPaths("Полный доступ ко всем модулям без лимитов")).toEqual([]);
  });

  test.each(AUDIENCE_FILES.map((f) => [path.relative(APP, f), f] as const))(
    "%s — every internal page link exists",
    (_rel, file) => {
      const src = fs.readFileSync(file, "utf8");
      const dead = citedPaths(src)
        // API paths are checked separately, against the router. /api-backend
        // is the proxy prefix the frontend goes through, not a page.
        .filter(({ p }) => !p.startsWith("/api/") && !p.startsWith("/api-backend/") && !p.includes("."))
        .filter(({ p }) => !ROUTES.has(p.replace(/\/$/, "") || "/"))
        .map(({ p, line }) => `${p} (line ${line})`);
      expect(dead).toEqual([]);
    },
  );

  test.each(AUDIENCE_FILES.map((f) => [path.relative(APP, f), f] as const))(
    "%s — every cited /api/aevion route exists",
    (_rel, file) => {
      const src = fs.readFileSync(file, "utf8");
      const dead = [...src.matchAll(/\/api\/aevion\/[a-z0-9-]+/g)]
        .map((m) => m[0])
        .filter((p) => !API_ROUTES.has(p));
      expect([...new Set(dead)]).toEqual([]);
    },
  );

  // Sweeping the whole app found five more of the same defect outside the
  // audience pages, all confirmed 404 on prod before being fixed:
  // /qpaynet/settings/webhooks (the webhook setup instructions for
  // developers — settings do not exist, subscriptions live in
  // /qpaynet/merchant), /qsign/v2 (there is one QSign page and it already is
  // v2 — it calls /api/qsign/v2/*), and a capstone-case button pointing at
  // /smeta-trainer/drawings-practice/case-school47, a page the roadmap still
  // lists as TODO. Zero left, so the sweep is pinned at zero.
  test("no page in the app links to a route that does not exist", () => {
    const allFiles: string[] = [];
    (function collect(dir: string) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) collect(p);
        else if (e.name.endsWith(".tsx")) allFiles.push(p);
      }
    })(APP);

    // Sample values inside documented API responses, not links anyone clicks.
    // Both describe a URL the API says it will hand back, and neither resolves
    // today — worth checking what prod actually returns, but that is a
    // question about the API, not a dead link on the page.
    const SAMPLE_VALUES_IN_API_DOCS = [
      "/qgood/cmp_2f1a8b/thanks/don_4f1a", // developers/fintech — thankYouUrl
      "/checkout/co_a3f7m1xyz", // payments/api — checkout session url
    ];

    const dead: string[] = [];
    for (const file of allFiles) {
      for (const { p, line } of citedPaths(fs.readFileSync(file, "utf8"))) {
        if (p.startsWith("/api/") || p.startsWith("/api-backend/")) continue;
        if (SAMPLE_VALUES_IN_API_DOCS.includes(p)) continue;
        if (p.includes(".") || p.includes("${")) continue;
        const clean = p.replace(/\/$/, "") || "/";
        if (ROUTES.has(clean)) continue;
        // A literal path may still be served by a dynamic segment.
        const segs = clean.split("/").slice(1);
        const dynamic = [...ROUTES].some((r) => {
          const rs = r.split("/").slice(1);
          return rs.length === segs.length && rs.every((s, i) => s === segs[i] || (s.startsWith("[") && s.endsWith("]")));
        });
        if (!dynamic) dead.push(`${clean} — ${path.relative(APP, file)}:${line}`);
      }
    }
    expect(dead).toEqual([]);
    expect(allFiles.length).toBeGreaterThan(1000);
  });

  // Started as a rule for the audience pages, then the sweep found the host
  // in three more places: a "Production OpenAPI" button on /fintech/status,
  // and the healthai module, which had its own way of reaching the backend —
  // a hardcoded Railway origin instead of getApiBase(). Prod answers the same
  // through the proxy (402 on /api/healthai/score/x either way), so the module
  // now goes the same route as everything else. Zero left, so zero is pinned.
  test("no page hardcodes the internal backend host", () => {
    const offenders: string[] = [];
    (function collect(dir: string) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) collect(p);
        else if (/\.tsx?$/.test(e.name) && fs.readFileSync(p, "utf8").includes(RAW_BACKEND_HOST)) {
          offenders.push(path.relative(APP, p));
        }
      }
    })(APP);
    expect(offenders).toEqual([]);
  });
});
