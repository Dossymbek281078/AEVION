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

// /vc — короткий адрес для vc.ru.
//
// ЗАЧЕМ. 28.09.2026 в текстах запуска DevHub стояла метка ?c=vc, а сайт её
// не знал: channelFrom вернул бы null, подписка и продажа ушли бы в
// "unattributed", и на вопрос «какая площадка сработала» ответа бы не было.
// Ровно так уже потеряли 37 постов с ?c=post. Канал отрабатывает один раз —
// проверять это ПОСЛЕ публикации поздно.
//
// Вторая половина того же дефекта: метка в каталоге есть, а короткого адреса
// нет — тогда ссылка из объявления даёт 404. Сторож
// everyChannelHasShortEntry.test.ts поймал у меня именно это.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Ведём на СТРАНИЦУ ПРОДУКТА, а не на общий вход: объявление — про DevHub,
  // и человек из него должен попасть туда, о чём объявление. Страница читает
  // ?c= (channelFrom) и доносит метку до кассы, как /go.
  const метка = меткаДляПерехода((await searchParams).c, "vc");
  if (метка !== "vc") redirect(`/devhub?c=${метка}`);
  redirect("/devhub?c=vc");
}
