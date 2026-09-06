import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
    "Бесплатный разбор: какие маркеры сдать, что из добавок и нагрузок реально доказано (A/B/C), а что переоценено. " +
    "Персональный стек по вашим цифрам и повторный замер через 12 недель. Wellness и образование, не диагностика и не лечение.",
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

// Своего заголовка у страницы не было — в <title> и в превью-карточках
// соцсетей отдавался общий «AEVION — Trust infrastructure for digital assets
// & IP». Это вторая посадочная в воронке из TikTok: человек делится ссылкой
// на протокол долголетия, а получатель видит корпоративный титул про
// инфраструктуру доверия и не открывает.
//
// Второй блок metadata убран при сведении веток 23.08.2026: два `export const
// metadata` в одном файле — ошибка сборки, а не выбор. Оставлен верхний, у него
// есть keywords; оговорка «wellness, не диагностика» из нижнего перенесена в
// его описание, потому что она не косметика: тематика здоровья — ограниченная
// категория и у поисковиков, и у рекламных систем.

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Метка канала (?c=fb, ?c=ig …). Страница — вторая посадочная после /go: на
  // неё ведут ролики про долголетие напрямую, и без проброса метки покупка
  // отсюда приходила бы в отчёт как «источник неизвестен».
  const channel = channelFrom((await searchParams).c);

  // Языковая маршрутизация: у страницы ЕСТЬ английская версия (/en/longevity),
  // но посетитель с выбранным английским всё равно попадал сюда и читал
  // русский протокол целиком — замер 06.09.2026 (ночной EN-свип): 75 %
  // кириллицы под cookie en при живой английской странице. Cookie
  // `aevion_lang_v1` — та самая, которую пишет общий переключатель языка и
  // читает сервер. Редирект ДО платной стены и до учёта: PageTracking должен
  // сработать один раз на той странице, которую человек реально увидит,
  // иначе просмотр посчитается дважды. Метку канала везём с собой — без неё
  // покупка с английской страницы пришла бы «источник неизвестен».
  const язык = (await cookies()).get("aevion_lang_v1")?.value;
  if (язык === "en") {
    redirect(channel ? `/en/longevity?c=${encodeURIComponent(channel)}` : "/en/longevity");
  }

  const r = await fetchOrPaywall("/api/longevity/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return (
    <>
      <PageTracking page="longevity" />
      <LongevityClient channel={channel} />
    </>
  );
}
