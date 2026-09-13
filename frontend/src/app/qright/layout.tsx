import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { AutoTranslate } from "@/components/AutoTranslate";

const SITE = getSiteUrl();
// 13.09.2026: явная ссылка на og.svg убрана. Она перебивала файловое
// соглашение Next (opengraph-image.tsx рядом) и подставляла SVG с СЫРОГО
// домена Railway, а SVG как превью не рисует ни одна крупная площадка —
// ссылка уходила в мессенджер голой. Теперь картинку даёт соседний
// opengraph-image.tsx: PNG 1200x630 с нашего домена, как у qsign и qskyway.
// Ручка /api/<модуль>/og.svg на сервере жива и не тронута: у неё могут
// быть другие потребители, здесь она просто больше не источник превью.

export const metadata: Metadata = {
  title: "AEVION QRight — author rights & royalty rail · права автора и роялти",
  description:
    "QRight is the AEVION authorship layer: register a work, get a content-hashed receipt with HMAC + Ed25519 signatures, threshold-shard the secret across Quantum Shield. Verify offline; route royalties through Bank. Слой авторства AEVION: регистрация работы, подписанный чек с хешем содержимого, проверка без доверия серверу, роялти через Bank.",
  openGraph: {
    title: "AEVION QRight — proof-of-authorship rail",
    description:
      "Register, sign, threshold-shard. Public verification page per object, embeddable badge, royalty rail to Bank.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QRight",
    description: "Proof-of-authorship rail with Ed25519 + Shamir + Bank royalty payouts.",
  },
  alternates: { canonical: "/qright" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "QRight — proof-of-authorship rail of AEVION",
  name: "AEVION QRight",
  description:
    "Register works, hash content canonically, dual-sign (HMAC + Ed25519), threshold-shard the secret on Quantum Shield. Public verification page + embeddable badge + Bank royalty payouts.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION QRight", "Proof of Authorship", "Ed25519", "Shamir Secret Sharing", "Royalties"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/qright` },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "QRight", item: `${SITE}/qright` },
  ],
};

export default function QRightLayout({ children }: { children: React.ReactNode }) {
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
      {/* QRight is an app-shell (global AutoTranslate runs observe=false), so
          re-enable a live observer scoped here — async-loaded registry records,
          verification results and error toasts translate into all 11 languages
          when the user switches via the app-shell pill. Mirrors build/layout. */}
      <AutoTranslate observe>{children}</AutoTranslate>
    </>
  );
}
