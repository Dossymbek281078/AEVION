import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aevion.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/auth"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
