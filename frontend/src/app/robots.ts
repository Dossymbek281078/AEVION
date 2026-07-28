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
          "/qpaynet/admin/",
          "/qpaynet/admin",
          "/constitution/admin",
          "/constitution/admin/",
          // Метки рекламных каналов не должны плодить дубли в выдаче.
          // /go?c=fb, /compare?c=tt, /qsign?c=ig — это те же страницы, что и
          // без параметра, но canonical есть не везде: из 35 страниц модулей
          // его задают 24, а корневой layout умолчания не даёт (проверено
          // 28.07.2026). Пока это так, дешевле закрыть параметр здесь, чем
          // получить по несколько адресов одной страницы в индексе.
          //
          // Правильное решение долгосрочно — canonical на каждой странице
          // модуля; тогда эту строку можно убрать. Список страниц без него:
          // qcoreai, qlearn, qevents, qmedia, qai, ventures, qstore, qnews,
          // healthai, smeta-trainer, devhub.
          "/*?c=",
        ],
      },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/api-backend/api/aevion/sitemap.xml`,
    ],
  };
}
