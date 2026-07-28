import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QChainGov — DAO Governance · AEVION",
  description:
    // Было «quadratic voting + delegate-trees» — ни того, ни другого в модуле нет:
    // в роутере ноль упоминаний quadratic/sqrt/delegat при 71 упоминании vote,
    // а вес голоса суммируется линейно (DOUBLE PRECISION), не по квадратному корню.
    // Оставлено то, что реализовано: три режима голосования и цепочка подписей.
    "DAO-платформа народного управления: identity-bound голоса через AEVION Auth, QSign-цепочка под каждым решением, режимы «да/нет», ранжированный и взвешенный.",
  alternates: { canonical: `${SITE}/qchaingov` },
  openGraph: {
    type: "website",
    url: `${SITE}/qchaingov`,
    title: "QChainGov — DAO Governance",
    description: "Identity-bound votes · QSign chain · ranked-choice and weighted modes · transparent process.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function QChainGovLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
