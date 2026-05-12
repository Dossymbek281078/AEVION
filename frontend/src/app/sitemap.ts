import type { MetadataRoute } from "next";
import { getApiBase } from "@/lib/apiBase";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

const TIERS = ["free", "pro", "business", "enterprise"];
const INDUSTRIES = ["banks", "startups", "government", "creators", "law-firms"];

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
  const [projectIds, vacancyIds, employerLeaderboard, popularSkills] = await Promise.all([
    fetchIds("/api/build/projects?limit=500&status=OPEN"),
    fetchIds("/api/build/vacancies?limit=1000&status=OPEN"),
    fetch(`${getApiBase()}/api/build/stats/leaderboard`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : { data: { employers: [] } }))
      .catch(() => ({ data: { employers: [] } })),
    fetch(`${getApiBase()}/api/build/vacancies/skills/popular`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : { data: { items: [] } }))
      .catch(() => ({ data: { items: [] } })),
  ]);

  const employerIds: string[] = ((employerLeaderboard?.data?.employers ?? []) as { userId: string }[])
    .map((e) => e.userId)
    .filter(Boolean);

  const skillSlugs: string[] = ((popularSkills?.data?.items ?? []) as { skill: string }[])
    .map((s) => s.skill?.trim())
    .filter((s): s is string => !!s)
    .slice(0, 50)
    .map((s) => s.toLowerCase().replace(/\s+/g, "-"));

  const today = new Date();
  const staticRoutes: MetadataRoute.Sitemap = TOP_LEVEL_ROUTES.map((r) => ({
    url: `${origin}${r.path}`,
    lastModified: today,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

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
