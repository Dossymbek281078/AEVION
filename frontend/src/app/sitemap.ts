import type { MetadataRoute } from "next";

// Хосты для prod (sitemap всегда абсолютные URLs).
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aevion.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const stat = (path: string, priority = 0.7, changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never" = "weekly") => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    stat("/", 1.0, "weekly"),
    stat("/aev", 0.95, "daily"),
    stat("/aev/tokenomics", 0.9, "weekly"),
    stat("/qtrade", 0.95, "daily"),
    stat("/cyberchess", 0.9, "weekly"),
    stat("/qsign", 0.85, "weekly"),
    stat("/qright", 0.85, "weekly"),
    stat("/bureau", 0.85, "weekly"),
    stat("/bank", 0.85, "weekly"),
    stat("/qcoreai", 0.8, "weekly"),
    stat("/multichat-engine", 0.8, "weekly"),
    stat("/quantum-shield", 0.7, "monthly"),
    stat("/planet", 0.7, "monthly"),
    stat("/awards", 0.7, "monthly"),
    stat("/awards/film", 0.6, "monthly"),
    stat("/awards/music", 0.6, "monthly"),
    stat("/demo", 0.6, "monthly"),
    stat("/demo/deep", 0.6, "monthly"),
    stat("/help", 0.6, "monthly"),
    stat("/privacy", 0.4, "yearly"),
    stat("/terms", 0.4, "yearly"),
    stat("/auth", 0.5, "monthly"),
  ];
}
