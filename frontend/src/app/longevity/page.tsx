import type { Metadata } from "next";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import { channelFrom } from "@/lib/products";
import LongevityClient from "./_client";

// Своего заголовка у страницы не было — в <title> и в превью-карточках
// соцсетей отдавался общий «AEVION — Trust infrastructure for digital assets
// & IP». Это вторая посадочная в воронке из TikTok: человек делится ссылкой
// на протокол долголетия, а получатель видит корпоративный титул про
// инфраструктуру доверия и не открывает. Формулировки — из ответа самой
// ручки /api/longevity/health (26 маркеров, 19 вмешательств, 12 недель),
// чтобы описание не разошлось с тем, что страница делает.
export const metadata: Metadata = {
  title: "Протокол долголетия — бесплатный разбор анализов",
  description:
    "Отметьте свои маркеры — получите персональный 12-недельный план и повторный замер. " +
    "26 маркеров панели, 19 вмешательств с оценкой доказательности, включая переоценённые. " +
    "Бесплатно. Wellness и образование, не диагностика и не лечение.",
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
  return <LongevityClient channel={channel} />;
}
