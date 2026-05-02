import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

const SITE = getSiteUrl();

export const metadata: Metadata = {
  title: "AEVION Help — FAQ for users and investors",
  description:
    "Everything about AEVION: how to register IP in QRight, how Planet validates artifacts, how Bank pays out AEC, how Awards work. Plus an investor FAQ on TAM, moat, revenue and exit.",
  openGraph: {
    title: "AEVION Help — user & investor FAQ",
    description: "QRight, Planet, Bank, Awards, CyberChess — answers in one place. Plus the investor FAQ behind the $1B+ thesis.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Help",
    description: "User & investor FAQ — QRight, Planet, Bank, Awards.",
  },
  alternates: { canonical: "/help" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is AEVION?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AEVION is a global trust infrastructure platform for digital content and intellectual property. It includes IP registration (QRight), cryptographic signatures (QSign), a patent bureau, compliance certification (Planet), creator awards, a digital bank, and more — all connected through a single identity and trust system.",
      },
    },
    {
      "@type": "Question",
      name: "How do I register my intellectual property?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Go to Auth → create an account → go to QRight → fill in the title and description of your work → click Register. Your content gets a cryptographic hash and timestamp that proves you had the content at this moment.",
      },
    },
    {
      "@type": "Question",
      name: "What is Planet Compliance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Planet is a verification layer. When you submit an artifact (code, music, film), Planet runs validators to check originality and compliance. If passed, you receive a certificate. Other users can vote on your work by category.",
      },
    },
    {
      "@type": "Question",
      name: "How does AEVION Bank work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AEVION Bank is a digital wallet inside the ecosystem. You earn AEVION Credits (AEC) from royalties, awards, and direct transfers. You can send AEC to other creators, receive automatic royalties when your content is used, and withdraw to external accounts.",
      },
    },
    {
      "@type": "Question",
      name: "What are AEVION Awards?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AEVION runs two award tracks: Music Awards (for AI and digital music) and Film Awards (for AI and digital cinema). Submit work through Planet, get certified, and the community votes. Top works win awards and AEC prizes.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data safe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. AEVION uses Quantum Shield cryptography (Ed25519 + Shamir Secret Sharing), encrypted storage, and Merkle-tree audit trails. Passwords are hashed. Private data is never exposed through the public Trust Graph.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use AEVION for free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Core features (registration, signing, bureau, Planet submission) are free. Premium features (advanced analytics, priority compliance, tournament entry) will have paid tiers. During the MVP phase, everything is free.",
      },
    },
    {
      "@type": "Question",
      name: "How is AEVION worth $1B+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Five independent axes: (1) first-mover monopoly on a unified IP+signature+bureau+compliance+wallet pipeline; (2) Trust Graph data moat that compounds with every action; (3) cross-vertical revenue across $340B TAM (IP, creator economy, payments) from a single codebase; (4) quantum-resistant crypto stack as institutional-grade trust signal; (5) 27 modules with near-zero marginal cost per node.",
      },
    },
    {
      "@type": "Question",
      name: "What is the revenue model?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Three independent revenue streams composing on the same codebase: (1) per-certificate and per-verification SaaS for IP Bureau and Planet; (2) take-rate on AEVION Bank flows (royalties, advances, payouts); (3) seat licensing for QCoreAI and Multichat enterprise agents. AEVION sells the same Trust Graph three times to three different buyers.",
      },
    },
    {
      "@type": "Question",
      name: "What is the moat?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Four compounding network effects: data (Trust Graph edges accumulate), economic (creators ↔ fans through Bank), switching cost (the average user has 6+ scheduled flows after 90 days), and scope (every new module makes the existing modules more valuable at zero marginal cost). The graph is non-replicable after ~10K active users.",
      },
    },
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Help", item: `${SITE}/help` },
  ],
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
