import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Music Awards — premium for AI and digital music",
  description:
    "AEVION Music Awards: submit through Planet (artifact type music), get a compliance certificate and AEC payout into AEVION Bank.",
  alternates: { canonical: "/awards/music" },
  openGraph: {
    title: "AEVION Music Awards",
    description: "Premium for AI and digital music on the Planet validator layer.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Music Awards",
    description: "Pre-Grammy era for AI music. QRight authorship, Planet validators, AEC payouts.",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Pre-Grammy era for AI music.",
  name: "AEVION Music Awards",
  description:
    "AEVION Music Awards: submit through Planet (artifact type music), get a compliance certificate and AEC payout into AEVION Bank.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Music Awards", "AI Music", "Creator Economy", "QRight", "Planet Validators"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/awards/music" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Awards", item: "https://aevion.app/awards" },
    { "@type": "ListItem", position: 3, name: "Music", item: "https://aevion.app/awards/music" },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Who can submit to AEVION Music Awards?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Any artist or producer who can register the original master in QRight (SHA-256 + HMAC + Quantum Shield). AI-assisted, generative and digital tracks are explicitly welcome — that is the entire point of the wave 1 program.",
      },
    },
    {
      "@type": "Question",
      name: "How is originality verified?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each submission passes Planet validator quorum. Validators check QRight authorship timestamp, duplicate fingerprints across the network, and metadata consistency. Verdicts are published on-chain — no opaque jury, no PR-driven shortlists.",
      },
    },
    {
      "@type": "Question",
      name: "What is the payout?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Top-3 winners settle in AEC directly into AEVION Bank. From there the funds are usable through Autopilot rules, savings goals, P2P transfer or off-ramp via Bank routes — no separate wallet step.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a submission fee?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Wave 1 submission for AI-music is free. The QRight registration step has a fixed micro-fee in AEC (covers Quantum Shield key derivation); the validator quorum itself is paid by the prize pool, not by submitters.",
      },
    },
    {
      "@type": "Question",
      name: "How long does validation take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Median quorum time is 12–36 hours depending on validator load. Complex multi-stem submissions (above 8 layers) may queue up to 72 hours. Status is visible in real time on the Planet artifact page once submitted.",
      },
    },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Submit a track to AEVION Music Awards",
  description: "Five-step flow from QRight authorship to AEC payout in AEVION Bank.",
  inLanguage: "en",
  totalTime: "PT15M",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Register authorship in QRight",
      text: "Upload the master to QRight to capture SHA-256 fingerprint, HMAC signature and Quantum Shield key derivation. This locks the authorship timestamp on-chain before anyone else sees the track.",
      url: "https://aevion.app/qright",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Open Planet → submit artifact",
      text: "On Planet choose artifact type 'music', attach the QRight reference and the public preview. Add credits, language tags and any sample provenance.",
      url: "https://aevion.app/planet",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Pass validator quorum",
      text: "Planet routes the submission to the validator pool. Quorum Y is reached when enough independent validators co-sign the verdict. Result is published on-chain.",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Community vote (top-30 → top-3)",
      text: "Cleared submissions enter the public vote round. Top-30 are featured on the Awards hub; top-3 lock in the final ranking after a fixed-window vote.",
    },
    {
      "@type": "HowToStep",
      position: 5,
      name: "AEC payout into AEVION Bank",
      text: "Winners receive AEC straight into their AEVION Bank wallet. Funds become immediately routable — Autopilot, savings goals, P2P, or off-ramp.",
      url: "https://aevion.app/bank",
    },
  ],
};

export default function MusicAwardsLayout({ children }: { children: React.ReactNode }) {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      {children}
    </>
  );
}
