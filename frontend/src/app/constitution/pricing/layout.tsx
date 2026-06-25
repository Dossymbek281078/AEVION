import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Pricing — Free, Pro $9, Team $49 · AEVION Constitution",
  description:
    "3 тарифа: Free (5 сохранений), Pro $9/mo (безлимит + AI без cap + clean PDF + embed), Team $49/mo (5 seats + admin + общие сценарии). Cancel anytime.",
  alternates: { canonical: `${SITE}/constitution/pricing` },
  openGraph: {
    title: "Constitution Pricing — Free / Pro / Team",
    description: "Constitution as a Service. От бесплатного редактора до team-плана с админкой и общими сценариями.",
    url: `${SITE}/constitution/pricing`,
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
