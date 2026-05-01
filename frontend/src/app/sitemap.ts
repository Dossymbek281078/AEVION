import type { MetadataRoute } from "next";
import { headers } from "next/headers";

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
  { path: "/awards", changeFrequency: "daily", priority: 0.8 },
  { path: "/qcoreai", changeFrequency: "weekly", priority: 0.7 },
  { path: "/cyberchess", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments", changeFrequency: "weekly", priority: 0.9 },
  { path: "/payments/links", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments/methods", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments/webhooks", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments/settlements", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments/subscriptions", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments/compliance", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments/api", changeFrequency: "weekly", priority: 0.7 },
  { path: "/payments/audit", changeFrequency: "weekly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getOrigin();
  const today = new Date();
  return TOP_LEVEL_ROUTES.map((r) => ({
    url: `${origin}${r.path}`,
    lastModified: today,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
