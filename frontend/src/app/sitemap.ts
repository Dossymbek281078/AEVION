import type { MetadataRoute } from "next";
import { getApiBase } from "@/lib/apiBase";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.io";

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
  { path: "/cyberchess", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qtrade", changeFrequency: "daily", priority: 0.85 },
  { path: "/aev", changeFrequency: "daily", priority: 0.8 },
  { path: "/aev/tokenomics", changeFrequency: "weekly", priority: 0.7 },
  { path: "/smeta-trainer", changeFrequency: "weekly", priority: 0.75 },
  { path: "/qcontract", changeFrequency: "weekly", priority: 0.75 },
  { path: "/qpaynet", changeFrequency: "weekly", priority: 0.8 },
  { path: "/qpaynet/merchant", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qpaynet/transactions", changeFrequency: "daily", priority: 0.6 },
  { path: "/qpaynet/request", changeFrequency: "weekly", priority: 0.65 },
  { path: "/qpaynet/requests", changeFrequency: "weekly", priority: 0.55 },
  { path: "/qpaynet/kyc", changeFrequency: "monthly", priority: 0.5 },
  { path: "/healthai", changeFrequency: "weekly", priority: 0.8 },
  { path: "/build", changeFrequency: "daily", priority: 1.0 },
  { path: "/build/vacancies", changeFrequency: "hourly", priority: 0.9 },
  { path: "/build/stats", changeFrequency: "hourly", priority: 0.7 },
  { path: "/build/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/build/referrals", changeFrequency: "daily", priority: 0.5 },
  { path: "/status", changeFrequency: "hourly", priority: 0.5 },
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

async function fetchCaseIds(): Promise<string[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/pricing/cases`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = (await r.json()) as { items?: Array<{ id: string }> };
    return (j.items ?? []).map((c) => c.id).filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = TOP_LEVEL_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
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

  const caseIds = await fetchCaseIds();
  const caseEntries: MetadataRoute.Sitemap = caseIds.map((id) => ({
    url: `${BASE_URL}/pricing/cases/${id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  return [...staticEntries, ...tierEntries, ...industryEntries, ...caseEntries];
}
