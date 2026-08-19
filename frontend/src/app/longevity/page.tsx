import type { Metadata } from "next";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import { channelFrom } from "@/lib/products";
import LongevityClient from "./_client";
import { PageTracking } from "@/components/PageTracking";

// Своя карточка в поиске. До 19.08.2026 страница наследовала общий заголовок
// сайта («AEVION — Trust infrastructure for digital assets & IP») и описание про
// регистрацию интеллектуальной собственности — то есть наш лучший бесплатный
// вход был невидим по своей теме, а тому, кто всё же дошёл, выдача обещала
// QRight и QSign. Проверено сравнением: у /go, /pricing и /bureau метаданные
// свои, у этой страницы их не было.
//
// Формулировки намеренно без обещаний результата: это образовательный
// материал, а тематика здоровья — ограниченная категория и у поисковиков, и у
// рекламных систем. Обещать «продлить жизнь» здесь нельзя ни по правилам, ни по
// совести — сама страница честно сортирует вмешательства по доказательности.
export const metadata: Metadata = {
  title: "Протокол долголетия: анализы, стек по доказательности, 12 недель",
  description:
    "Бесплатный разбор: какие маркеры сдать, что из добавок и нагрузок реально доказано (A/B/C), а что переоценено. Персональный стек по вашим цифрам и повторный замер через 12 недель.",
  keywords: [
    "протокол долголетия",
    "биологический возраст",
    "PhenoAge",
    "биомаркеры старения",
    "витамин D норма",
    "омега-3 индекс",
    "ApoB",
    "VO2max",
    "доказательная медицина добавки",
  ],
  alternates: { canonical: "https://aevion.app/longevity" },
  openGraph: {
    title: "Протокол долголетия: измерь → воздействуй → перемерь",
    description:
      "Что сдать, что делать и что из этого доказано. Честная градация A/B/C — включая то, что переоценено.",
    url: "https://aevion.app/longevity",
    type: "article",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const r = await fetchOrPaywall("/api/longevity/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  // Метка канала (?c=fb, ?c=ig …). Страница — вторая посадочная после /go: на
  // неё ведут ролики про долголетие напрямую, и без проброса метки покупка
  // отсюда приходила бы в отчёт как «источник неизвестен».
  const channel = channelFrom((await searchParams).c);
  return (
    <>
      <PageTracking page="longevity" />
      <LongevityClient channel={channel} />
    </>
  );
}
