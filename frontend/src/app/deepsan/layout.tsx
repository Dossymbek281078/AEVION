import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "DeepSan — Anti-chaos Productivity · AEVION",
  description:
    "Антихаос-приложение: tasks как состояния, AI inbox-парсер, принудительные фокус-сессии, bridge к QCoreAI агентам.",
  alternates: { canonical: `${SITE}/deepsan` },
  openGraph: {
    type: "website",
    url: `${SITE}/deepsan`,
    title: "DeepSan — Anti-chaos Productivity",
    description: "Tasks as states · AI inbox parser · enforced focus · QCoreAI agent bridge.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function DeepSanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
