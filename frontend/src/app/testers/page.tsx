import { redirect } from "next/navigation";

import { меткаДляПерехода, хвостПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Перенаправление закрыто от поисковика (как у /sh, /fz): короткий адрес — вход, не страница.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /testers — короткий вход для тестировщиков шахмат (18.10.2026, слово оркестратора): уже разосланы метки
// testers-yt, testers-club-<страна>, testers-uni (13 описаний роликов, 19 писем клубам). Сторож everyChannelHasShortEntry требует у каждого ключа каталога свой короткий адрес,
// иначе ссылка в подписи даст 404. Ведём на экран игры: задание тестировщика — 3 партии с телефона;
// полная метка (?c=testers-club-au) доносится как есть через меткаДляПерехода.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const параметры = await searchParams;
  const метка = меткаДляПерехода(параметры.c, "testers");
  const хвост = хвостПерехода(параметры);
  if (метка !== "testers" || хвост) redirect(`/cyberchess?c=${метка}${хвост}`);
  redirect("/cyberchess?c=testers");
}
