import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { AutoTranslate } from "@/components/AutoTranslate";

const SITE = getSiteUrl();

// QSign has no module-specific og.svg backend endpoint (it is a stateless
// sign/verify service), so the OG image falls back to the root
// app/opengraph-image.tsx. Metadata text is the important SEO win here — the
// page was previously a bare "use client" route with no title/description.
export const metadata: Metadata = {
  title: "AEVION QSign — canonical-JSON signing · подпись и проверка документов",
  description:
    "QSign signs any JSON payload over an RFC 8785-canonical form: deterministic key ordering, HMAC and Ed25519 signatures, offline verification. The signing primitive under QRight receipts, Bureau certificates and Planet attestations. Подпись любого JSON-документа и проверка офлайн — тот же примитив, что заверяет чеки QRight и сертификаты Bureau.",
  openGraph: {
    title: "AEVION QSign — deterministic signing & verification",
    description:
      "Canonical-JSON (RFC 8785) signing with HMAC + Ed25519. Sign a payload, verify it offline, key-version rotation built in. The signature layer of the AEVION Trust OS.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QSign",
    description:
      "Canonical-JSON (RFC 8785) signing with HMAC + Ed25519 and offline verification.",
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
