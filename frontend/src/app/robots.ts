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
    sitemap: [
      `${origin}/sitemap.xml`,
      `${origin}/api-backend/api/aevion/sitemap.xml`,
    ],
  };
}
