import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Film Awards — premium for AI and digital cinema",
  description:
    "AEVION Film Awards: submit through Planet (artifact type film), pass validator quorum, get a compliance certificate and AEC payout into AEVION Bank. No closed jury, no IP take.",
  alternates: { canonical: "/awards/film" },
  openGraph: {
    title: "AEVION Film Awards",
    description: "Premium for AI and digital cinema on the Planet validator layer.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Film Awards",
    description: "The first credible AI-film festival. QRight authorship, Planet validators, AEC payouts.",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "The first credible AI-film festival.",
  name: "AEVION Film Awards",
  description:
    "AEVION Film Awards: submit through Planet (artifact type film), pass validator quorum, get a compliance certificate and AEC payout into AEVION Bank.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION Film Awards", "AI Film", "Digital Cinema", "Creator Economy", "QRight", "Planet Validators"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/awards/film" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Awards", item: "https://aevion.app/awards" },
    { "@type": "ListItem", position: 3, name: "Film", item: "https://aevion.app/awards/film" },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Who can submit to AEVION Film Awards?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Any director, animator or studio working with AI or digital cinema tools. Hybrid live-action + AI compositing pipelines are welcome. The bar is provable authorship in QRight, not the production stack.",
      },
    },
    {
      "@type": "Question",
      name: "What formats are accepted?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Short film (under 12 minutes) and feature (12+). Both must include an HLS or MP4 master plus a 30-second preview cut. Vertical-only submissions are routed to a separate short-form track and do not compete with cinema entries.",
      },
    },
    {
      "@type": "Question",
      name: "How is the jury structured?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There is no closed jury. Planet validator quorum certifies originality and metadata. The community vote (open to all AEVION Bank holders with KYC light) decides the top-30 → top-3. Verdicts are published on-chain.",
      },
    },
    {
      "@type": "Question",
      name: "How are payouts and rights handled?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Top-3 receive AEC into AEVION Bank. Authorship and royalty splits stay with the creator — AEVION takes no IP, no exclusive license, no rev-share on future distribution. The Planet artifact page becomes a public proof of the award.",
      },
    },
    {
      "@type": "Question",
      name: "When does Film wave 2 open?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Music wave 1 ships first; Film wave 2 follows once the music submission flow has cleared a full quorum cycle. The Awards hub at /awards shows the live wave status and exact open/close dates as soon as they are committed.",
      },
    },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Submit a film to AEVION Film Awards",
  description: "Five-step flow from QRight authorship to AEC payout in AEVION Bank.",
  inLanguage: "en",
  totalTime: "PT30M",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Register authorship in QRight",
      text: "Hash the film master in QRight (SHA-256 + HMAC + Quantum Shield). For multi-track films register each cut you want individually attributed (director's cut, festival cut, theatrical cut).",
      url: "https://aevion.app/qright",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Open Planet → submit artifact",
      text: "On Planet choose artifact type 'film', attach the QRight reference, the public 30s preview, and the full master link (HLS or MP4). Add credits, country, language tags, and AI-tool disclosure.",
      url: "https://aevion.app/planet",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Pass validator quorum",
      text: "Validators verify the QRight timestamp, run perceptual-hash dedupe across the network, and check the AI-tool disclosure for completeness. Verdicts are published on-chain.",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Community vote (top-30 → top-3)",
      text: "Cleared films enter the public vote round on the Awards hub. Top-30 get a featured slot; top-3 are decided by a fixed-window vote among AEVION Bank holders.",
    },
    {
      "@type": "HowToStep",
      position: 5,
      name: "AEC payout into AEVION Bank",
      text: "Winners receive AEC into the AEVION Bank wallet. The Planet artifact page becomes the public award proof — citable in pitch decks, distribution deals and festival applications.",
      url: "https://aevion.app/bank",
    },
  ],
};

export default function FilmAwardsLayout({ children }: { children: React.ReactNode }) {
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
