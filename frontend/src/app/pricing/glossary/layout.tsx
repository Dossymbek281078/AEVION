import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Глоссарий AEVION — TSP, eIDAS, SOC2, PCI DSS и ещё 25+ терминов",
  description:
    "Словарь технических терминов AEVION: TSP, eIDAS, SOC2, GDPR, 152-ФЗ, PCI DSS, BYOK, RBAC, MSA, DPA, RPO/RTO, ARR/MRR/LTV. С EN/RU расшифровкой и cross-links.",
  openGraph: {
    title: "AEVION Glossary",
    description: "30+ терминов по праву, compliance, технологиям, аутентификации и биллингу.",
    type: "website",
    url: "https://aevion.io/pricing/glossary",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Glossary",
    description: "30+ терминов: TSP, eIDAS, SOC2, GDPR, BYOK, RBAC и другие.",
  },
  alternates: {
    canonical: "/pricing/glossary",
  },
};

export default function PricingGlossaryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
