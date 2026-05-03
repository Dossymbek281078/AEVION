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
];

async function fetchIds(path: string): Promise<string[]> {
  try {
    const res = await fetch(`${getApiBase()}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const j = await res.json();
    return (j?.data?.items ?? []).map((r: { id: string }) => r.id).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, projectIds, vacancyIds] = await Promise.all([
    getOrigin(),
    fetchIds("/api/build/projects?limit=200&status=OPEN"),
    fetchIds("/api/build/vacancies?limit=200&status=OPEN"),
  ]);

  const today = new Date();
  const staticRoutes: MetadataRoute.Sitemap = TOP_LEVEL_ROUTES.map((r) => ({
    url: `${origin}${r.path}`,
    lastModified: today,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const projectRoutes: MetadataRoute.Sitemap = projectIds.map((id) => ({
    url: `${origin}/build/p/${id}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const vacancyRoutes: MetadataRoute.Sitemap = vacancyIds.map((id) => ({
    url: `${origin}/build/vacancy/${id}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...projectRoutes, ...vacancyRoutes];
}
