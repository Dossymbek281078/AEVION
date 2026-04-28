import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.io";

const TIERS = ["free", "pro", "business", "enterprise"];
const INDUSTRIES = ["banks", "startups", "government", "creators", "law-firms"];

const STATIC_ROUTES = [
  "",
  "/auth",
  "/awards",
  "/bank",
  "/bureau",
  "/cyberchess",
  "/demo",
  "/help",
  "/multichat-engine",
  "/planet",
  "/pricing",
  "/pricing/affiliate",
  "/pricing/api-pricing",
  "/pricing/cases",
  "/pricing/changelog",
  "/pricing/compare",
  "/pricing/contact",
  "/pricing/edu",
  "/pricing/partners",
  "/pricing/refund-policy",
  "/pricing/roadmap",
  "/pricing/security",
  "/privacy",
  "/qcoreai",
  "/qright",
  "/qsign",
  "/qtrade",
  "/quantum-shield",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/pricing" || path === "" ? "weekly" : "monthly",
    priority:
      path === "" ? 1.0 : path.startsWith("/pricing") ? 0.9 : 0.7,
  }));

  const tierEntries: MetadataRoute.Sitemap = TIERS.map((id) => ({
    url: `${BASE_URL}/pricing/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  const industryEntries: MetadataRoute.Sitemap = INDUSTRIES.map((id) => ({
    url: `${BASE_URL}/pricing/for/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...tierEntries, ...industryEntries];
}
