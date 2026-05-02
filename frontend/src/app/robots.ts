import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/api-backend/", "/pay/", "/r/", "/account/", "/_next/"],
      },
    ],
    // Two sitemap directives: the Next.js-generated top-level page sitemap
    // and the backend sitemap-index that fans out into per-module sitemaps
    // (modules / bureau / awards / pipeline / qright / quantum-shield /
    // planet). Crawlers merge both.
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/api-backend/api/aevion/sitemap.xml`,
    ],
  };
}
