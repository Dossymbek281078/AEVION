import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/api-backend/",
          "/pay/",
          "/r/",
          "/account/",
          "/_next/",
          // Раньше админки перечислялись поимённо, и каждый новый модуль со своей
          // админкой приходилось дописывать руками. К 28.07.2026 в карте сайта
          // оказались /pricing/admin и /smeta-trainer/admin, которых тут нет.
          // Подстановка закрывает их разом — Google и Bing поддерживают * в пути.
          "/*/admin",
          "/*/admin/",
        ],
      },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/api-backend/api/aevion/sitemap.xml`,
    ],
  };
}
