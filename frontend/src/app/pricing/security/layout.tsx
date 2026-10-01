import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Безопасность и соответствие требованиям",
  description:
    "Шифрование, контроль доступа, аудит, BCP и безопасная разработка. Узнайте, как AEVION защищает ваши данные.",
  openGraph: {
    title: "Безопасность и соответствие — AEVION Security",
    description:
      "Безопасность AEVION: шесть уровней безопасности, резидентность данных в EU/RU/KZ и программа Bug Bounty.",
    type: "website",
    url: "https://aevion.app/pricing/security",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Security & Compliance",
    description: "Статус соответствия без обещаний. Данные в EU/RU/KZ или вашем VPC.",
  },
  alternates: {
    canonical: "/pricing/security",
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
