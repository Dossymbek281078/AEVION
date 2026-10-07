import type { Metadata } from "next";
import { englishUrlWithChannel } from "@/lib/englishPages";

// 19.08.2026: платный продукт с общим заголовком сайта не находился по своей
// теме вовсе. Формулировки без обещаний результата — тематика здоровья.
export const metadata: Metadata = {
  title: "QRenew — биологический возраст по анализам крови",
  description:
    "Считает фенотипический возраст (PhenoAge) по девяти маркерам крови и показывает разницу с паспортным. Стек вмешательств отсортирован по доказательности.",
  alternates: { canonical: "https://aevion.app/qrenew", languages: языки("/qrenew") },
  openGraph: {
    // 06.10.2026: язык объявлен СЕРВЕРНО. Замер того же дня: у этой страницы
    // кириллицы больше, чем латиницы, а og:locale не было вовсе, и корневой
    // макет отдаёт lang="en". Поправить сам lang на уровне страницы нельзя
    // (<html> живёт только в корневом макете, разбор там же в комментарии),
    // поэтому серверный языковой сигнал даём тем, чем можно: og:locale.
    locale: "ru_RU",
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
import { языки } from "@/lib/hreflang";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ app?: string | string[]; c?: string | string[] }>;
}) {
  // Языковая маршрутизация — тот же приём, что у /longevity, /go и /shop
  // (мутации у сторожей пойманы там). Замер EN-свипа 06.09.2026: под cookie
  // en страница отдавала 61 % кириллицы. Редирект до платной стены и до
  // учёта — просмотр считается один раз, на странице, которую человек видит.
  //
  // 14.09.2026: `?app` — вход в само приложение. Без него кнопка на /en/qrenew
  // вела сюда же, и редирект возвращал на посадочную: круг (прод: cookie en →
  // 307 /en/qrenew). Сторож — enModuleLandings.guard.
  const язык = (await cookies()).get("aevion_lang_v1")?.value;
  const входВПриложение = (await searchParams).app !== undefined;

  // 🔴 01.10.2026: уводим ТОЛЬКО если английская страница есть. Замер прода:
  // с кукой aevion_lang_v1=en было 6 шагов и снова 307 — бесконечный круг,
  // потому что /en/qrenew своей страницы не имеет и middleware возвращал
  // гостя сюда. Список английских страниц один на всех: lib/englishPages.
  const enUrl = englishUrlWithChannel("/qrenew", (await searchParams).c);
  if (язык === "en" && !входВПриложение && enUrl) {
    redirect(enUrl);
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
