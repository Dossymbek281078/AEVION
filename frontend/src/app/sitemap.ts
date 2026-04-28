import type { MetadataRoute } from "next";

const BASE = "https://aevion.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const top = [
    "",
    "/auth",
    "/awards",
    "/awards/film",
    "/awards/music",
    "/bank",
    "/bureau",
    "/cyberchess",
    "/help",
    "/multichat-engine",
    "/planet",
    "/privacy",
    "/qcoreai",
    "/qright",
    "/qsign",
    "/qtrade",
    "/quantum-shield",
    "/terms",
  ].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1.0 : 0.6,
  }));

  const payments = [
    "/payments",
    "/payments/links",
    "/payments/methods",
    "/payments/webhooks",
    "/payments/settlements",
    "/payments/subscriptions",
    "/payments/fraud",
    "/payments/compliance",
    "/payments/api",
    "/payments/dashboard",
  ].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "/payments" ? 0.9 : 0.7,
  }));

  return [...top, ...payments];
}
