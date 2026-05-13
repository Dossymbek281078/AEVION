import type { MetadataRoute } from "next";
import { getApiBase } from "@/lib/apiBase";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

const TOP_LEVEL_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/modules", changeFrequency: "daily", priority: 0.9 },
  { path: "/qright", changeFrequency: "daily", priority: 0.9 },
  { path: "/qright/transparency", changeFrequency: "weekly", priority: 0.6 },
  { path: "/bureau", changeFrequency: "daily", priority: 0.9 },
  { path: "/bureau/transparency", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qsign", changeFrequency: "weekly", priority: 0.7 },
  { path: "/quantum-shield", changeFrequency: "weekly", priority: 0.7 },
  { path: "/planet", changeFrequency: "daily", priority: 0.8 },
  { path: "/awards", changeFrequency: "daily", priority: 0.8 },
  { path: "/qcoreai", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qcoreai/multi", changeFrequency: "weekly", priority: 0.65 },
  { path: "/qcoreai/playground", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qcoreai/optimize", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qcoreai/pipeline", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qcoreai/docs", changeFrequency: "monthly", priority: 0.7 },
  { path: "/qcoreai/providers", changeFrequency: "weekly", priority: 0.55 },
  { path: "/cyberchess", changeFrequency: "weekly", priority: 0.7 },
  { path: "/cyberchess/cpi", changeFrequency: "monthly", priority: 0.65 },
  { path: "/cyberchess/cpi/dashboard", changeFrequency: "daily", priority: 0.7 },
  { path: "/cyberchess/cpi/leaderboard", changeFrequency: "hourly", priority: 0.75 },
  { path: "/cyberchess/economy", changeFrequency: "weekly", priority: 0.6 },
  { path: "/cyberchess/training", changeFrequency: "daily", priority: 0.7 },
  { path: "/cyberchess/tournament", changeFrequency: "daily", priority: 0.75 },
  { path: "/cyberchess/studio", changeFrequency: "weekly", priority: 0.6 },
  // QBuild static routes
  { path: "/build", changeFrequency: "daily", priority: 1.0 },
  { path: "/build/vacancies", changeFrequency: "hourly", priority: 0.9 },
  { path: "/build/stats", changeFrequency: "hourly", priority: 0.7 },
  { path: "/build/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/build/why-aevion", changeFrequency: "weekly", priority: 0.7 },
  { path: "/build/referrals", changeFrequency: "daily", priority: 0.5 },
  { path: "/build/leaderboard", changeFrequency: "daily", priority: 0.6 },
  { path: "/build/help", changeFrequency: "weekly", priority: 0.5 },
  { path: "/build/salary", changeFrequency: "hourly", priority: 0.75 },
  { path: "/build/interviews", changeFrequency: "daily", priority: 0.6 },
  { path: "/build/ai-match", changeFrequency: "weekly", priority: 0.65 },
  { path: "/keys", changeFrequency: "monthly", priority: 0.6 },
  // HealthAI standalone pages
  { path: "/healthai", changeFrequency: "weekly", priority: 0.8 },
  { path: "/healthai/screener", changeFrequency: "monthly", priority: 0.6 },
  { path: "/healthai/plan", changeFrequency: "weekly", priority: 0.65 },
  { path: "/healthai/cycle", changeFrequency: "daily", priority: 0.6 },
  // QCoreAI
  { path: "/qcoreai/budget", changeFrequency: "monthly", priority: 0.55 },
  { path: "/qcoreai/api-keys", changeFrequency: "monthly", priority: 0.5 },
  { path: "/qcoreai/orgs", changeFrequency: "weekly", priority: 0.55 },
  // QPayNet
  { path: "/qpaynet", changeFrequency: "weekly", priority: 0.8 },
  { path: "/qpaynet/merchant", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qpaynet/transactions", changeFrequency: "daily", priority: 0.6 },
  { path: "/qpaynet/request", changeFrequency: "weekly", priority: 0.65 },
  { path: "/qpaynet/requests", changeFrequency: "weekly", priority: 0.55 },
  // QContract
  { path: "/qcontract", changeFrequency: "weekly", priority: 0.75 },
  { path: "/qcontract/create", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qcontract/documents", changeFrequency: "daily", priority: 0.5 },
  // DevHub — AI developer platform
  { path: "/devhub", changeFrequency: "weekly", priority: 0.8 },
  // Smeta Trainer
  { path: "/smeta-trainer", changeFrequency: "weekly", priority: 0.75 },
  // QTradeOffline
  { path: "/qtradeoffline", changeFrequency: "weekly", priority: 0.6 },
  // Planning / Idea landings
  { path: "/qfusionai", changeFrequency: "monthly", priority: 0.55 },
  { path: "/veilnetx", changeFrequency: "monthly", priority: 0.5 },
  { path: "/qmaskcard", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qpersona", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qlife", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qgood", changeFrequency: "monthly", priority: 0.5 },
  { path: "/voice-of-earth", changeFrequency: "monthly", priority: 0.45 },
  { path: "/kids-ai-content", changeFrequency: "monthly", priority: 0.5 },
  { path: "/startup-exchange", changeFrequency: "monthly", priority: 0.5 },
  { path: "/shadownet", changeFrequency: "monthly", priority: 0.4 },
  { path: "/deepsan", changeFrequency: "monthly", priority: 0.45 },
  { path: "/psyapp-deps", changeFrequency: "monthly", priority: 0.45 },
  { path: "/mapreality", changeFrequency: "monthly", priority: 0.4 },
  { path: "/z-tide", changeFrequency: "monthly", priority: 0.35 },
  { path: "/lifebox", changeFrequency: "monthly", priority: 0.45 },
  { path: "/qchaingov", changeFrequency: "monthly", priority: 0.4 },
  // Fintech ecosystem
  { path: "/fintech", changeFrequency: "weekly", priority: 0.7 },
  { path: "/fintech/catalog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/fintech/modules", changeFrequency: "weekly", priority: 0.65 },
  { path: "/fintech/status", changeFrequency: "hourly", priority: 0.55 },
  { path: "/fintech/dashboard", changeFrequency: "weekly", priority: 0.5 },
  { path: "/fintech/whitepaper", changeFrequency: "monthly", priority: 0.5 },
  { path: "/fintech/compare", changeFrequency: "monthly", priority: 0.45 },
  { path: "/fintech/analytics", changeFrequency: "hourly", priority: 0.6 },
  { path: "/fintech/integrations", changeFrequency: "monthly", priority: 0.6 },
  { path: "/fintech/changelog", changeFrequency: "weekly", priority: 0.5 },
  { path: "/developers/fintech", changeFrequency: "weekly", priority: 0.7 },
  { path: "/developers/fintech/quickstart", changeFrequency: "monthly", priority: 0.65 },
  { path: "/developers/fintech/sdk", changeFrequency: "monthly", priority: 0.6 },
  { path: "/developers/fintech/webhooks", changeFrequency: "monthly", priority: 0.6 },
  { path: "/developers/fintech/errors", changeFrequency: "monthly", priority: 0.55 },
  { path: "/developers/fintech/examples", changeFrequency: "monthly", priority: 0.6 },
  { path: "/developers/fintech/migration", changeFrequency: "monthly", priority: 0.5 },
  { path: "/developers/fintech/rate-limits", changeFrequency: "monthly", priority: 0.5 },
  // Launch status
  { path: "/launch-status", changeFrequency: "hourly", priority: 0.5 },
];

const DEFAULT_CHANGE_FREQ: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly";
const DEFAULT_PRIORITY = 0.6;

/**
 * Walk `frontend/src/app/**` at build time and pick up every `page.tsx` so we
 * don't have to hand-maintain a route list (and forget routes like
 * `/cyberchess/studio` did historically). Returns route paths relative to the
 * app root (e.g. `/qcoreai/playground`, or `/` for the root page).
 *
 * Excludes:
 *  - Dynamic segments (`[id]`, `[slug]`, `[...rest]`) — those routes are
 *    generated separately via `fetchIds()` against real data.
 *  - Route groups `(group)` — they don't appear in URLs but are folder-only.
 *  - Private folders starting with `_` (e.g. `_components`).
 *  - The `api/` tree — server routes, not crawlable pages.
 *
 * Runtime-safe: only invoked when `fs` is actually available (Node runtime
 * during build). On edge/runtime where the FS isn't reachable, the caller
 * falls back to the manual `TOP_LEVEL_ROUTES` list.
 */
async function scanAppRoutes(): Promise<string[]> {
  // Dynamic imports so the module graph doesn't drag node:fs into edge bundles.
  // Wrapped in try/catch so any failure (sandboxed runtime, missing dir,
  // permissions) just degrades to an empty array.
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    // `process.cwd()` is the project root during `next build` (usually the
    // `frontend/` directory). The Next.js convention is `src/app/**`.
    const appDir = path.join(process.cwd(), "src", "app");

    // Quick sanity check — if the dir isn't there, we're probably running in
    // a serverless/edge context. Bail.
    try {
      const stat = await fs.stat(appDir);
      if (!stat.isDirectory()) return [];
    } catch {
      return [];
    }

    const routes: string[] = [];

    async function walk(dir: string, segments: string[]): Promise<void> {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const name = entry.name;

        if (entry.isDirectory()) {
          // Skip dynamic segments (handled by fetchIds elsewhere).
          if (name.startsWith("[")) continue;
          // Skip private folders, route groups, and node_modules-ish stuff.
          if (name.startsWith("_")) continue;
          if (name.startsWith("(") && name.endsWith(")")) continue;
          // Skip the API tree — those aren't browseable URLs.
          if (segments.length === 0 && name === "api") continue;

          await walk(path.join(dir, name), [...segments, name]);
          continue;
        }

        if (!entry.isFile()) continue;
        if (name !== "page.tsx" && name !== "page.ts" && name !== "page.jsx" && name !== "page.js") continue;

        // Build the route path from the segments we walked into.
        const route = segments.length === 0 ? "/" : "/" + segments.join("/");
        routes.push(route);
      }
    }

    await walk(appDir, []);
    return routes;
  } catch {
    return [];
  }
}

async function fetchIds(path: string, idField: string = "id"): Promise<string[]> {
  try {
    const res = await fetch(`${getApiBase()}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const j = await res.json();
    return (j?.data?.items ?? [])
      .map((r: Record<string, unknown>) => r[idField] as string | undefined)
      .filter((v: string | undefined): v is string => !!v);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pull employer IDs from the leaderboard endpoint — that's a public,
  // already-curated list of brand-name profiles worth indexing. Capped
  // server-side at 20+20, so cheap to fetch.
  const origin = BASE_URL;
  const [projectIds, vacancyIds, employerLeaderboard, popularSkills, scannedRoutes] = await Promise.all([
    fetchIds("/api/build/projects?limit=500&status=OPEN"),
    fetchIds("/api/build/vacancies?limit=1000&status=OPEN"),
    fetch(`${getApiBase()}/api/build/stats/leaderboard`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : { data: { employers: [] } }))
      .catch(() => ({ data: { employers: [] } })),
    fetch(`${getApiBase()}/api/build/vacancies/skills/popular`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : { data: { items: [] } }))
      .catch(() => ({ data: { items: [] } })),
    scanAppRoutes(),
  ]);

  const employerIds: string[] = ((employerLeaderboard?.data?.employers ?? []) as { userId: string }[])
    .map((e) => e.userId)
    .filter(Boolean);

  const skillSlugs: string[] = ((popularSkills?.data?.items ?? []) as { skill: string }[])
    .map((s) => s.skill?.trim())
    .filter((s): s is string => !!s)
    .slice(0, 50)
    .map((s) => s.toLowerCase().replace(/\s+/g, "-"));

  // Merge strategy:
  // 1. Every route in TOP_LEVEL_ROUTES keeps its hand-tuned changeFreq + priority
  //    (SEO-sensitive — hourly leaderboards, daily landings, etc.).
  // 2. Any route found on disk that ISN'T in TOP_LEVEL_ROUTES gets defaults.
  // 3. If the FS scan returned nothing (edge runtime, sandbox, etc.), we still
  //    have the full TOP_LEVEL_ROUTES list as a baseline.
  const overrideMap = new Map(TOP_LEVEL_ROUTES.map((r) => [r.path, r]));
  const allPaths = new Set<string>(TOP_LEVEL_ROUTES.map((r) => r.path));
  for (const p of scannedRoutes) allPaths.add(p);

  const today = new Date();
  const staticRoutes: MetadataRoute.Sitemap = Array.from(allPaths).map((p) => {
    const override = overrideMap.get(p);
    return {
      url: `${origin}${p}`,
      lastModified: today,
      changeFrequency: override?.changeFrequency ?? DEFAULT_CHANGE_FREQ,
      priority: override?.priority ?? DEFAULT_PRIORITY,
    };
  });

  const projectRoutes: MetadataRoute.Sitemap = projectIds.map((id) => ({
    url: `${origin}/build/project/${id}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const vacancyRoutes: MetadataRoute.Sitemap = vacancyIds.map((id) => ({
    url: `${origin}/build/vacancy/${id}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const employerRoutes: MetadataRoute.Sitemap = employerIds.map((id) => ({
    url: `${origin}/build/employer/${id}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const skillRoutes: MetadataRoute.Sitemap = skillSlugs.map((slug) => ({
    url: `${origin}/build/skill/${slug}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Cap total at 5000 so the sitemap stays valid (Google limit is 50k but
  // we prefer multiple smaller files long-term — single sitemap is enough
  // for now).
  const all = [...staticRoutes, ...skillRoutes, ...vacancyRoutes, ...projectRoutes, ...employerRoutes];
  return all.slice(0, 5000);
}
