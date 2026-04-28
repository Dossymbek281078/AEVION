const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Trust by construction — AEVION platform security.",
  name: "AEVION Security",
  description:
    "Six-layer platform security overview: Quantum Shield key management, Ed25519 signatures, identity scope, validator quorum, audit trails and public vulnerability disclosure.",
  inLanguage: ["en"],
  about: ["AEVION", "Platform Security", "Cryptography", "Compliance", "Audit"],
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://aevion.app/security" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Where is the data stored, and who can access it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Authorship and payment data live in encrypted PostgreSQL with row-level access control. Master keys never leave Quantum Shield (k-of-n shards across independent stores). No employee has unilateral access — all privileged actions are logged to a Merkle-tree audit trail.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if a private key is compromised?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Quantum Shield key recovery: rotate the affected shards (any K of N is enough to reconstruct), revoke the compromised public key in QSign, re-sign the affected receipts, broadcast revocation through the Planet validator network. Authorship timestamps remain valid because they are separate from the user signing key.",
      },
    },
    {
      "@type": "Question",
      name: "Are you ready for post-quantum?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The signature stack today is Ed25519. Quantum Shield key derivation is post-quantum-ready — KDF can swap to a PQ-safe primitive (e.g. ML-KEM) without re-issuing existing receipts. Dilithium preview is already in the QSign repository.",
      },
    },
    {
      "@type": "Question",
      name: "How do you handle vulnerability reports?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Send to yahiin1978@gmail.com with subject 'AEVION security' or use the /.well-known/security.txt contact. Acknowledgment within 24 hours, fix coordination per CVD norms, public credit on /changelog once mitigated.",
      },
    },
    {
      "@type": "Question",
      name: "Do you publish a SOC 2 / ISO 27001 report?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not yet — at MVP scale we ship the controls before paying for the audit. The control map (encryption at rest, least-privilege access, audit trails, incident response) is implemented and documented for under-NDA review.",
      },
    },
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: "https://aevion.app" },
    { "@type": "ListItem", position: 2, name: "Security", item: "https://aevion.app/security" },
  ],
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
