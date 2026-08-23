import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

/**
 * Единственный источник правды о том, что закрыто от поисковика.
 *
 * Экспортируется, потому что этот же список нужен карте сайта: до 21.08.2026
 * она собиралась обходом каталогов и ничего про запреты не знала, поэтому
 * ОТДАВАЛА поисковику 19 адресов, которые здесь же запрещены — 9 админских,
 * 8 в админке QPayNet, личный кабинет и админку конституции. Google на такое
 * отвечает документированно: адрес попадает в выдачу БЕЗ содержимого, то есть
 * ссылка на админку видна, а вместо описания стоит «заблокировано в
 * robots.txt». Плюс постоянная ошибка в Search Console.
 *
 * Второй список заводить нельзя: разъедется — и мы снова будем звать
 * поисковика туда, куда сами его не пускаем.
 */
export const DISALLOWED_PATHS = [
  "/admin/",
  "/api/",
  "/api-backend/",
  "/pay/",
  "/r/",
  "/account/",
  "/_next/",
  "/qpaynet/admin/",
  "/qpaynet/admin",
  "/constitution/admin",
  "/constitution/admin/",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/api-backend/api/aevion/sitemap.xml`,
    ],
  };
}
