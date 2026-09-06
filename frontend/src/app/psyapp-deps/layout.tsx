import type { ReactNode } from "react";
import type { Metadata } from "next";
import ComplianceBanner from "@/components/ComplianceBanner";
import { ModuleMaturity } from "@/components/ModuleMaturity";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "PsyApp — Dependencies Exit · AEVION",
  description:
    "Платформа выхода из зависимостей: ML trigger-детекция, анонимные группы поддержки, профилактика срывов, эскалация к QGood-специалисту.",
  alternates: { canonical: `${SITE}/psyapp-deps` },
  openGraph: {
    type: "website",
    url: `${SITE}/psyapp-deps`,
    title: "PsyApp — Dependencies Exit",
    description: "Behavioral analytics for addiction recovery · anonymous group support · QGood specialist escalation.",
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
