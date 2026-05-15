import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QChainGov — DAO Governance · AEVION",
  description:
    "DAO-платформа народного управления: identity-bound голоса через AEVION Auth, QSign-цепочка под каждым решением, quadratic voting + delegate-trees.",
  alternates: { canonical: `${SITE}/qchaingov` },
  openGraph: {
    type: "website",
    url: `${SITE}/qchaingov`,
    title: "QChainGov — DAO Governance",
    description: "Identity-bound votes · QSign chain · quadratic voting · delegate trees · transparent process.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function QChainGovLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
