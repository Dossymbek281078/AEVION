import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import QSkywayClient from "./_client";
import { PageTracking } from "@/components/PageTracking";

const TITLE = "QSkyway — navigation layer for the urban sky · навигация городского неба";
const DESCRIPTION =
  "Навигационный слой городского неба: 3D-коридоры аэротакси по правилам, которые "
  + "регуляторы реально публикуют. "
  + "Provider-independent 3D air corridors + rules for air taxis, live on real buildings in "
  + "Astana, NYC & Tokyo. Routed against what the regulators actually publish: FAA airspace "
  + "ceilings over Manhattan, Japan's MLIT permission regime over Tokyo, and Kazakhstan's "
  + "published prohibited area UAP28 covering all of the Astana twin. Live METAR wind, "
  + "height-data provenance, an airspace-slot "
  + "rights market, and every flight exportable as a signed justification document.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "urban air mobility", "UAM", "eVTOL", "air taxi", "air corridors", "vertiport",
    "airspace management", "3D city", "navigation", "AEVION", "QSkyway",
  ],
  alternates: { canonical: "/qskyway" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/qskyway",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function Page() {
  // Языковая маршрутизация — 6-й случай приёма (образцы /longevity, /go,
  // /shop, /smeta-trainer, /qrenew; мутации у сторожей пойманы там).
  // Замер EN-свипа 06.09.2026: 57 % кириллицы под cookie en при живом
  // международном предмете. Редирект до платной стены и до учёта.
  const язык = (await cookies()).get("aevion_lang_v1")?.value;
  if (язык === "en") {
    redirect("/en/qskyway");
  }

  const r = await fetchOrPaywall("/api/qskyway/health");
  // Считаем ОБЕ ветки. Посещение есть посещение: человек, пришедший с ролика
  // по /go?c=yt и упёршийся в платную стену, пришёл на страницу так же, как
  // тот, кто увидел модуль. Считай мы только вторую — число называлось бы
  // «посещения qskyway», а означало бы «посещения теми, у кого есть доступ»,
  // и канал выглядел бы слабее, чем он есть.
  if ("paywall" in r) {
    return (
      <>
        <PageTracking page="qskyway" />
        <PaywallScreen payload={r.paywall} backHref="/modules" />
      </>
    );
  }
  return (
    <>
      <PageTracking page="qskyway" />
      <QSkywayClient />
    </>
  );
}
