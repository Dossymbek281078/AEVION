import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Internal API + auth surfaces — there's nothing useful for
        // a crawler there and we don't want bots hammering the proxy.
        disallow: ["/api/", "/auth", "/_next/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
