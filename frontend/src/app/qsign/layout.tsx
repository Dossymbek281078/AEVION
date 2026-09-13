import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { AutoTranslate } from "@/components/AutoTranslate";

const SITE = getSiteUrl();

// QSign has no module-specific og.svg backend endpoint (it is a stateless
// sign/verify service), so the OG image falls back to the root
// app/opengraph-image.tsx. Metadata text is the important SEO win here — the
// page was previously a bare "use client" route with no title/description.
export const metadata: Metadata = {
  // 13.09.2026: absolute, потому что имя платформы уже стоит В САМОМ
  // заголовке, а корневой шаблон добавлял второе. Замер на живом сайте:
  // «... · AEVION» у 14 страниц из 14 в выборке. Вкладка и выдача поиска
  // режут около шестидесяти знаков — второй бренд выталкивал оттуда
  // нужные слова. Страницам БЕЗ имени в заголовке шаблон по-прежнему нужен,
  // поэтому корневой файл не тронут.
  title: { absolute: "AEVION QSign — canonical-JSON signing · подпись и проверка документов" },
  description:
    "QSign signs any JSON payload over an RFC 8785-canonical form: deterministic key ordering, HMAC and Ed25519 signatures, offline verification. The signing primitive under QRight receipts, Bureau certificates and Planet attestations. Подпись любого JSON-документа и проверка офлайн — тот же примитив, что заверяет чеки QRight и сертификаты Bureau.",
  openGraph: {
    // 13.09.2026: перевод англоязычного превью — см. тот же комментарий
    // в qright/layout.tsx. Утверждения не менялись.
    title: "AEVION QSign — детерминированная подпись и проверка",
    description:
      "Подпись канонического JSON (RFC 8785) на HMAC и Ed25519. Подписать данные, проверить их без сети, смена версий ключа встроена. Слой подписи в AEVION Trust OS.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QSign — подпись и проверка",
    description:
      "Подпись канонического JSON (RFC 8785) на HMAC и Ed25519, проверка без сети.",
  },
  alternates: { canonical: "/qsign" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "QSign — deterministic signing layer of AEVION",
  name: "AEVION QSign",
  description:
    "Canonical-JSON (RFC 8785) signing with HMAC and Ed25519 signatures and offline verification. QSign is the signature primitive under QRight receipts, Bureau certificates and Planet attestations.",
  inLanguage: ["en", "ru", "kk"],
  proficiencyLevel: "Expert",
  about: ["Digital Signatures", "HMAC", "Ed25519", "RFC 8785", "Canonical JSON"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/qsign` },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "QSign", item: `${SITE}/qsign` },
  ],
};

export default function QSignLayout({ children }: { children: React.ReactNode }) {
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
      {/* QSign is an app-shell (global AutoTranslate runs observe=false), so
          re-enable a live observer scoped here — sign/verify result messages
          and key-rotation prose translate into all 11 languages on switch.
          Mirrors build/layout. */}
      <AutoTranslate observe>{children}</AutoTranslate>
    </>
  );
}
