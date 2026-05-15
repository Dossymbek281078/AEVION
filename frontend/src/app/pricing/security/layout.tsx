import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Безопасность и соответствие требованиям — AEVION",
  description:
    "SOC 2 Type II, GDPR, 152-ФЗ, PCI DSS. Шифрование, контроль доступа, аудит, BCP и безопасная разработка. Узнайте, как AEVION защищает ваши данные.",
  openGraph: {
    title: "Безопасность и соответствие — AEVION Security",
    description:
      "Enterprise-grade защита: SOC 2 Type II, GDPR, 152-ФЗ, PCI DSS. Шесть уровней безопасности, резидентность данных в EU/RU/KZ и программа Bug Bounty.",
    type: "website",
    url: "https://aevion.io/pricing/security",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Security & Compliance",
    description: "SOC 2 · GDPR · 152-ФЗ · PCI DSS. Данные в EU/RU/KZ или вашем VPC.",
  },
  alternates: {
    canonical: "/pricing/security",
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
