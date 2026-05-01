import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth", "/api/", "/_next/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
