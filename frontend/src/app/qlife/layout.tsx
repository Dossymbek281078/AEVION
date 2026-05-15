import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QLife — Personal OS · AEVION",
  description:
    "Personal Operating System: единый интерфейс для всей жизни — финансы, здоровье, расписание, отношения, цели. AI-агент держит фокус, ты управляешь.",
  alternates: { canonical: `${SITE}/qlife` },
  openGraph: {
    type: "website",
    url: `${SITE}/qlife`,
    title: "QLife — Personal OS",
    description: "All-in-one personal OS: finance/health/schedule/relationships/goals in one agent-driven dashboard.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/qlife/opengraph-image`, width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function QLifeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
