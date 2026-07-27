import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import { channelFrom } from "@/lib/products";
import LongevityClient from "./_client";

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
