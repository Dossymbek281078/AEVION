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

// /hn — короткий адрес для Hacker News.
//
// ЗАЧЕМ. Тексты западного запуска готовы и ждут руки основателя, а метки
// канала для Hacker News в каталоге не было: переход вернул бы из channelFrom
// null, продажа ушла бы в "unattributed", и на вопрос «окупился ли западный
// канал» ответа бы не нашлось. Канал отрабатывает один раз — проверять это
// после публикации поздно.
//
// Адрес ставится в тексте Show HN и в комментариях под ним. Он короткий (его набирают руками с телефона) и
// сам доставляет метку. Никакой логики здесь нет и быть не должно — только
// перенаправление.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Ведём на СТРАНИЦУ ПРОДУКТА, а не на общий вход: объявление Show HN — про DevHub («describe an app in plain words»), и вести его надо на страницу DevHub, а не на общий вход «что почитать и попробовать».
  // Проверено 08.09.2026 — эта страница читает ?c= (channelFrom) и доносит
  // метку до кассы, как /go.
  const метка = меткаДляПерехода((await searchParams).c, "hn");
  if (метка !== "hn") redirect(`/en/devhub?c=${метка}`);
  redirect("/en/devhub?c=hn");
}
