import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {}
  return "https://aevion.tech";
}

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
  { path: "/planet/transparency", changeFrequency: "weekly", priority: 0.6 },
  { path: "/awards", changeFrequency: "daily", priority: 0.8 },
  { path: "/awards/results", changeFrequency: "daily", priority: 0.8 },
  { path: "/qcoreai", changeFrequency: "weekly", priority: 0.7 },
  { path: "/cyberchess", changeFrequency: "weekly", priority: 0.7 },
  // QBuild static routes
  { path: "/build", changeFrequency: "daily", priority: 1.0 },
  { path: "/build/vacancies", changeFrequency: "hourly", priority: 0.9 },
  { path: "/build/stats", changeFrequency: "hourly", priority: 0.7 },
  { path: "/build/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/build/why-aevion", changeFrequency: "weekly", priority: 0.7 },
  { path: "/build/referrals", changeFrequency: "daily", priority: 0.5 },
  { path: "/build/leaderboard", changeFrequency: "daily", priority: 0.6 },
  { path: "/build/help", changeFrequency: "weekly", priority: 0.5 },
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
  const [origin, projectIds, vacancyIds, employerLeaderboard, popularSkills] = await Promise.all([
    getOrigin(),
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
