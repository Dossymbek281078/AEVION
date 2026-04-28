import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Quantum Shield — Shamir's Secret Sharing + Ed25519 protection",
  description:
    "Quantum Shield splits master keys via Shamir's Secret Sharing across independent shards. Ed25519 signatures, threshold recovery, post-quantum-ready key derivation — the cryptographic floor under QRight, QSign, Bureau, Bank.",
  openGraph: {
    title: "AEVION Quantum Shield — cryptographic floor of the Trust OS",
    description:
      "Threshold-secret sharding (k of n), Ed25519 signing, post-quantum-ready key derivation. The shared crypto layer of every AEVION module.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Quantum Shield",
    description: "Shamir secret sharing + Ed25519 + post-quantum-ready KDF.",
  },
  alternates: { canonical: "/quantum-shield" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Quantum Shield — the cryptographic floor of AEVION",
  name: "AEVION Quantum Shield",
  description:
    "Threshold-secret sharding (Shamir, k of n), Ed25519 signatures and post-quantum-ready key derivation. Quantum Shield protects masters before they enter QRight, QSign, Bureau and Bank.",
  inLanguage: ["en", "ru", "kk"],
  proficiencyLevel: "Expert",
  about: ["Cryptography", "Shamir's Secret Sharing", "Ed25519", "Post-Quantum", "Key Management"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/quantum-shield" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Quantum Shield", item: "https://aevion.app/quantum-shield" },
  ],
};

export default function QuantumShieldLayout({ children }: { children: React.ReactNode }) {
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
