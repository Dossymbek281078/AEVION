import type { ReactNode } from "react";
import type { Metadata } from "next";
import ComplianceBanner from "@/components/ComplianceBanner";
import { ModuleMaturity } from "@/components/ModuleMaturity";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QLife — долголетие и здоровые привычки",
  description:
    "Personal Operating System: единый интерфейс для всей жизни — финансы, здоровье, расписание, отношения, цели. AI-агент держит фокус, ты управляешь.",
  alternates: { canonical: `${SITE}/qlife` },
  openGraph: {
    type: "website",
    url: `${SITE}/qlife`,
    title: "QLife — долголетие и здоровые привычки",
    description: "Биомаркеры, тренды и AI-план привычек. Не медицинская консультация, результат не гарантирован.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/qlife/opengraph-image`, width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function QLifeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ComplianceBanner variant="medical" />
      <ModuleMaturity id="qlife" />
      {children}
    </>
  );
}
