import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они решают отдельную задачу: закрыть его от поисковика.
// Короткий адрес — вход для человека из объявления, а не страница: в выдаче
// ему делать нечего, и без noindex он соревновался бы за показы с той
// страницей, на которую ведёт.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /ph — короткий адрес для Product Hunt.
//
// ЗАЧЕМ. Тексты западного запуска готовы и ждут руки основателя, а метки
// канала для Product Hunt в каталоге не было: переход вернул бы из channelFrom
// null, продажа ушла бы в "unattributed", и на вопрос «окупился ли западный
// канал» ответа бы не нашлось. Канал отрабатывает один раз — проверять это
// после публикации поздно.
//
// Адрес ставится в карточке продукта и в первом комментарии. Он короткий (его набирают руками с телефона) и
// сам доставляет метку. Никакой логики здесь нет и быть не должно — только
// перенаправление.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Ведём на СТРАНИЦУ ПРОДУКТА, а не на общий вход: карточка Product Hunt — тот же продукт («Describe it. Get a deployed project»).
  // Проверено 08.09.2026 — эта страница читает ?c= (channelFrom) и доносит
  // метку до кассы, как /go.
  const метка = меткаДляПерехода((await searchParams).c, "ph");
  if (метка !== "ph") redirect(`/en/devhub?c=${метка}`);
  redirect("/en/devhub?c=ph");
}
