import type { Metadata } from "next";

// 19.08.2026: платный продукт с общим заголовком сайта не находился по своей
// теме вовсе. Формулировки без обещаний результата — тематика здоровья.
export const metadata: Metadata = {
  title: "QRenew — биологический возраст по анализам крови",
  description:
    "Считает фенотипический возраст (PhenoAge) по девяти маркерам крови и показывает разницу с паспортным. Стек вмешательств отсортирован по доказательности.",
  alternates: { canonical: "https://aevion.app/qrenew" },
  openGraph: {
    title: "QRenew — биологический возраст по анализам",
    description: "PhenoAge по девяти маркерам крови и честная градация того, что на него влияет.",
    url: "https://aevion.app/qrenew",
    type: "website",
  },
};

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import QRenewClient from "./_client";
import { PageTracking } from "@/components/PageTracking";

export default async function Page() {
  // Языковая маршрутизация — тот же приём, что у /longevity, /go и /shop
  // (мутации у сторожей пойманы там). Замер EN-свипа 06.09.2026: под cookie
  // en страница отдавала 61 % кириллицы. Редирект до платной стены и до
  // учёта — просмотр считается один раз, на странице, которую человек видит.
  const язык = (await cookies()).get("aevion_lang_v1")?.value;
  if (язык === "en") {
    redirect("/en/qrenew");
  }

  const r = await fetchOrPaywall("/api/qrenew/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return (
    <>
      <PageTracking page="qrenew" />
      <QRenewClient />
    </>
  );
}
