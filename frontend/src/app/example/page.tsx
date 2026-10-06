import { redirect } from "next/navigation";
import { channelFrom, keepChannel } from "@/lib/products";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

/*
 * /example — короткий адрес для постов и роликов про галерею примеров DevHub.
 *
 * 🔴 ВХОДЯЩУЮ МЕТКУ НЕ СТИРАЕМ (06.10.2026). Первая редакция перенаправляла
 * безусловно на /devhub?c=example, то есть /example?c=yt-devhub-opishi теряла
 * «yt» — а ролик user-10 уже стоит именно с такой ссылкой. Все его переходы
 * легли бы в канал «example», и ответ на вопрос «дал ли ролик людей» пропал бы.
 * Это ровно тот класс, что потеря ?c=post: 37 постов мерили воронку в никуда.
 *
 * Поэтому: годная входящая метка СОХРАНЯЕТСЯ (общий помощник keepChannel, он же
 * проверяет метку по каталогу CHANNELS), а «example» ставится только когда
 * метки нет или она неизвестна.
 *
 * ⚠️ Нижний вызов перенаправления записан ЛИТЕРАЛОМ намеренно: сторож
 * everyChannelHasShortEntry ищет в файле первое такое вхождение и разбирает его
 * ?c= целиком. Соберёте адрес только в переменную — сторож скажет «вход никуда
 * не ведёт».
 *
 * И ещё тоньше: в этом примечании нельзя приводить сам вызов в кавычках. Первая
 * редакция так и сделала — сторож разобрал ВХОЖДЕНИЕ ИЗ КОММЕНТАРИЯ и объявил,
 * что метка не доносится. Текст о вещи неотличим от вещи.
 *
 * force-static здесь больше нельзя: страница читает строку запроса.
 */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const параметры = await searchParams;
  /*
   * ДВА ШАГА, и порядок не произволен. `?c=yt` — это КЛЮЧ, а keepChannel ждёт
   * ЗНАЧЕНИЕ канала («youtube»): channelParam внутри него ищет по значениям.
   * Поэтому сперва channelFrom (ключ → значение, мусор → null), и только потом
   * keepChannel. Поймал на себе: без первого шага keepChannel молча возвращал
   * путь без метки, и проверка показала потерю «yt».
   */
  const канал = channelFrom(параметры.c);
  if (канал) redirect(keepChannel("/devhub", канал));
  redirect("/devhub?c=example");
}
