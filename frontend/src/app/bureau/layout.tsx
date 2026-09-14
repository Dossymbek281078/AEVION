import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();
// 13.09.2026: явная ссылка на og.svg убрана. Она перебивала файловое
// соглашение Next (opengraph-image.tsx рядом) и подставляла SVG с СЫРОГО
// домена Railway, а SVG как превью не рисует ни одна крупная площадка —
// ссылка уходила в мессенджер голой. Теперь картинку даёт соседний
// opengraph-image.tsx: PNG 1200x630 с нашего домена, как у qsign и qskyway.
// Ручка /api/<модуль>/og.svg на сервере жива и не тронута: у неё могут
// быть другие потребители, здесь она просто больше не источник превью.

export const metadata: Metadata = {
  // 13.09.2026: absolute, потому что имя платформы уже стоит В САМОМ
  // заголовке, а корневой шаблон добавлял второе. Замер на живом сайте:
  // «... · AEVION» у 14 страниц из 14 в выборке. Вкладка и выдача поиска
  // режут около шестидесяти знаков — второй бренд выталкивал оттуда
  // нужные слова. Страницам БЕЗ имени в заголовке шаблон по-прежнему нужен,
  // поэтому корневой файл не тронут.
  title: { absolute: "AEVION Bureau — public registry of authors · публичный реестр авторов" },
  description:
    "Public registry of creators and organizations: profiles, certificates with a public verification link, embeddable badges. Identity checks and notary are in demo mode. Реестр авторов и организаций: профили, сертификаты с проверкой по ссылке, значки. Личность и нотариус — в демо-режиме.",
  openGraph: {
    title: "AEVION Бюро — реестр авторов и организаций",
    description:
      "Реестр авторов и организаций: профили, сертификаты, встраиваемые значки, публичная проверка по ссылке. Проверка личности и нотариус — пока в демо-режиме.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Бюро — реестр авторов",
    description: "Реестр авторов и организаций: сертификаты и значки, проверка по ссылке. Личность и нотариус — в демо-режиме.",
  },
  alternates: { canonical: "/bureau" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AEVION Bureau — public registry for creators and orgs",
  name: "AEVION Bureau",
  description:
    "Public registry of creators and organizations: profiles, certificates with a public verification link, embeddable badges. Identity checks and notary signature are currently in demo mode.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Bureau", "Creator Registry", "Organization Registry", "Certificates", "Public Verification Link"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/bureau` },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Bureau", item: `${SITE}/bureau` },
  ],
};

export default function BureauLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
