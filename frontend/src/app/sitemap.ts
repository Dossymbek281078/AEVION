import type { MetadataRoute } from "next";

const ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/",                  priority: 1.0, changeFrequency: "weekly" },
  { path: "/pitch",             priority: 0.95, changeFrequency: "weekly" },
  { path: "/pitch/print",       priority: 0.6, changeFrequency: "weekly" },
  { path: "/demo",              priority: 0.9, changeFrequency: "weekly" },
  { path: "/demo/deep",         priority: 0.8, changeFrequency: "monthly" },
  { path: "/auth",              priority: 0.6, changeFrequency: "monthly" },
  { path: "/qright",            priority: 0.85, changeFrequency: "weekly" },
  { path: "/qsign",             priority: 0.8, changeFrequency: "weekly" },
  { path: "/bureau",            priority: 0.85, changeFrequency: "weekly" },
  { path: "/quantum-shield",    priority: 0.8, changeFrequency: "weekly" },
  { path: "/qtrade",            priority: 0.7, changeFrequency: "weekly" },
  { path: "/planet",            priority: 0.85, changeFrequency: "weekly" },
  { path: "/bank",              priority: 0.9, changeFrequency: "weekly" },
  { path: "/bank/about",        priority: 0.85, changeFrequency: "monthly" },
  { path: "/bank/trust",        priority: 0.85, changeFrequency: "monthly" },
  { path: "/bank/card",         priority: 0.8, changeFrequency: "monthly" },
  { path: "/bank/security",     priority: 0.85, changeFrequency: "monthly" },
  { path: "/bank/help",         priority: 0.7, changeFrequency: "monthly" },
  { path: "/bank/savings",      priority: 0.8, changeFrequency: "weekly" },
  { path: "/bank/circles",      priority: 0.75, changeFrequency: "weekly" },
  { path: "/bank/glossary",     priority: 0.75, changeFrequency: "monthly" },
  { path: "/bank/onboarding",   priority: 0.85, changeFrequency: "monthly" },
  { path: "/bank/insights",     priority: 0.8, changeFrequency: "weekly" },
  { path: "/bank/api",          priority: 0.7, changeFrequency: "monthly" },
  { path: "/bank/badge",        priority: 0.7, changeFrequency: "monthly" },
  { path: "/bank/explore",      priority: 0.85, changeFrequency: "weekly" },
  { path: "/bank/leaderboard",  priority: 0.75, changeFrequency: "daily" },
  { path: "/bank/share",        priority: 0.6, changeFrequency: "weekly" },
  { path: "/awards",            priority: 0.8, changeFrequency: "weekly" },
  { path: "/awards/music",      priority: 0.75, changeFrequency: "weekly" },
  { path: "/awards/film",       priority: 0.75, changeFrequency: "weekly" },
  { path: "/cyberchess",        priority: 0.8, changeFrequency: "weekly" },
  { path: "/qcoreai",           priority: 0.75, changeFrequency: "weekly" },
  { path: "/multichat-engine",  priority: 0.7, changeFrequency: "weekly" },
  { path: "/help",              priority: 0.5, changeFrequency: "monthly" },
  { path: "/changelog",         priority: 0.4, changeFrequency: "weekly" },
  { path: "/privacy",           priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms",             priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app";
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
