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

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api-backend/", "/account/", "/_next/"],
      },
    ],
    // Two sitemap directives: the Next.js-generated top-level page sitemap
    // and the backend sitemap-index that fans out into per-module sitemaps
    // (modules / bureau / awards / pipeline / qright / quantum-shield /
    // planet). Both are valid per robots.txt spec; crawlers merge them.
    sitemap: [
      `${origin}/sitemap.xml`,
      `${origin}/api-backend/api/aevion/sitemap.xml`,
    ],
  };
}
