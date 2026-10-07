import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они решают отдельную задачу: закрыть его от поисковика.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /x-multichat — короткий адрес для метки воронки «бесплатный пост в X про Multichat».
//
// ЗАЧЕМ. Метку завело соседнее окно 28.09.2026 (посты X и бриф платной
// кампании ведут на ?c=x-multichat), а короткого адреса к ней не было — и сторож
// everyChannelHasShortEntry.test.ts покраснел: метка в каталоге есть, а
// /x-multichat отвечал бы 404. Для платной кампании это прямая потеря: объявление
// оплачено, переход по короткому адресу не доходит.
//
// Страница ничего не решает — только доносит СВОЮ метку до целевой страницы,
// которая читает ?c= через channelFrom.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const метка = меткаДляПерехода((await searchParams).c, "x-multichat");
  if (метка !== "x-multichat") redirect(`/multichat-engine?c=${метка}`);
  redirect("/multichat-engine?c=x-multichat");
}
