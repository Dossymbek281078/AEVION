import type { ReactNode } from "react";
import type { Metadata } from "next";
import ComplianceBanner from "@/components/ComplianceBanner";
import { ModuleMaturity } from "@/components/ModuleMaturity";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "PsyApp — Dependencies Exit",
  description:
    // 28.10.2026: прежде обещала ML-детекцию триггеров, группы поддержки и эскалацию к специалисту — этого нет.
    "Анонимная помощь в выходе из зависимостей: счётчик дней, журнал триггеров, ИИ-поддержка и аффирмация дня. Без имени и email.",
  alternates: { canonical: `${SITE}/psyapp-deps` },
  openGraph: {
    type: "website",
    url: `${SITE}/psyapp-deps`,
    title: "PsyApp — Dependencies Exit",
    description: "Anonymous help with quitting addictions: day counter, trigger journal, AI support and a daily affirmation. No name, no email.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function PsyAppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ComplianceBanner variant="medical" />
      <ModuleMaturity id="psyapp-deps" />
      {children}
    </>
  );
}
