import type { Metadata } from "next";

// 19.08.2026: см. соседние страницы — общий заголовок сайта вместо своего.
export const metadata: Metadata = {
  title: "QMelanin — пигмент, седина и баланс цинк/медь",
  description:
    "Разбор того, почему седеет волос и что из этого доказано: медь, цинк, соотношение Zn:Cu, спермидин. С оценкой доказательности у каждого пункта.",
  alternates: { canonical: "https://aevion.app/qmelanin" },
  openGraph: {
    title: "QMelanin — пигмент и седина без обещаний",
    description: "Что реально влияет на пигмент, а что переоценено. Градация доказательности.",
    url: "https://aevion.app/qmelanin",
    type: "website",
  },
};

import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import QMelaninClient from "./_client";
import { PageTracking } from "@/components/PageTracking";

export default async function Page() {
  const r = await fetchOrPaywall("/api/qmelanin/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return (
    <>
      <PageTracking page="qmelanin" />
      <QMelaninClient />
    </>
  );
}
