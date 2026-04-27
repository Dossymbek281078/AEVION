import type { MetadataRoute } from "next";
import { getApiBase } from "@/lib/apiBase";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app";

type LatestCert = { id: string; protectedAt: string };

async function fetchLatestCerts(): Promise<LatestCert[]> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/pipeline/bureau/stats`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { latest?: LatestCert[] } | null;
    return Array.isArray(j?.latest) ? j!.latest! : [];
  } catch {
    return [];
  }
}

// All known top-level public routes on this branch. Keep in sync as new
// pages land; the /verify/[id] entries are appended dynamically below.
const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/bureau", priority: 0.9, changeFrequency: "daily" },
  { path: "/qright", priority: 0.8, changeFrequency: "weekly" },
  { path: "/qsign", priority: 0.7, changeFrequency: "weekly" },
  { path: "/quantum-shield", priority: 0.6, changeFrequency: "monthly" },
  { path: "/qcoreai", priority: 0.5, changeFrequency: "monthly" },
  { path: "/qtrade", priority: 0.5, changeFrequency: "monthly" },
  { path: "/cyberchess", priority: 0.5, changeFrequency: "monthly" },
  { path: "/planet", priority: 0.5, changeFrequency: "monthly" },
  { path: "/multichat-engine", priority: 0.5, changeFrequency: "monthly" },
  { path: "/awards/film", priority: 0.5, changeFrequency: "monthly" },
  { path: "/awards/music", priority: 0.5, changeFrequency: "monthly" },
  { path: "/bank", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Bureau is the primary public surface — expose every recently
  // protected certificate's verify URL so search engines can index
  // them (each is a real, durable page with its own dynamic OG card).
  const latest = await fetchLatestCerts();
  const verifyEntries: MetadataRoute.Sitemap = latest.slice(0, 200).map((c) => ({
    url: `${BASE}/verify/${c.id}`,
    lastModified: c.protectedAt ? new Date(c.protectedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...base, ...verifyEntries];
}
