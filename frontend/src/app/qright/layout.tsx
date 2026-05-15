import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { getApiBase } from "@/lib/apiBase";

const SITE = getSiteUrl();
const OG_IMAGE = `${getApiBase()}/api/qright/og.svg`;

export const metadata: Metadata = {
  title: "AEVION QRight — author rights, on-chain receipts, royalty rail",
  description:
    "QRight is the AEVION authorship layer: register a work, get a content-hashed receipt with HMAC + Ed25519 signatures, threshold-shard the secret across Quantum Shield. Verify offline; route royalties through Bank.",
  openGraph: {
    title: "AEVION QRight — proof-of-authorship rail",
    description:
      "Register, sign, threshold-shard. Public verification page per object, embeddable badge, royalty rail to Bank.",
    type: "website",
    siteName: "AEVION",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AEVION QRight" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QRight",
    description: "Proof-of-authorship rail with Ed25519 + Shamir + Bank royalty payouts.",
    images: [OG_IMAGE],
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
      {children}
    </>
  );
}
