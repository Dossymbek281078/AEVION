import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Welcome to Constitution — 4-step onboarding · AEVION",
  description:
    "Первый раз тут? 4 коротких шага: что это, выбери страну, подкрути ползунок, увидь свой регим. Пропустить можно в любой момент.",
  alternates: { canonical: `${SITE}/constitution/welcome` },
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
