import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/pay/"],
      },
    ],
    sitemap: "https://aevion.app/sitemap.xml",
  };
}
