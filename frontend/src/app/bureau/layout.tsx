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
  title: "AEVION Bureau — public verified registry · публичный реестр авторов",
  description:
    "AEVION Bureau is the public registry of verified authors, organizations and notarized certificates. KYC + payment + Planet quorum stamp every entry; embed badges on your portfolio or contracts. Публичный реестр проверенных авторов и организаций: заверенные сертификаты, значки для портфолио и договоров.",
  openGraph: {
    title: "AEVION Bureau — verified creator + org registry",
    description:
      "Verified creators, B2B organizations, notarized certificates. Embed badges, link from contracts, audit publicly.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bureau",
    description: "Verified creator + org registry. Embed badges, audit publicly.",
  },
  alternates: { canonical: "/bureau" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AEVION Bureau — verified registry for creators and orgs",
  name: "AEVION Bureau",
  description:
    "Public registry of verified creators and organizations. KYC + payment + Planet quorum stamp every certificate. Embed badges from your portfolio or notarized contracts.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Bureau", "Verified Creators", "B2B Verification", "Notarized Certificates", "Trust Registry"],
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
