import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

/*
 * /multichat — короткое имя, которое люди набирают руками.
 *
 * 28.09.2026: рабочий адрес модуля — /multichat-engine, а /multichat отдавал 404.
 * Посетитель из Show HN, X или Product Hunt наберёт короткое; терять его на пустой
 * странице нельзя. Метку канала ПЕРЕНОСИМ: без неё переход дойдёт живым, но уйдёт
 * в «unattributed», и ответа «какой пост привёл человека» не будет.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const параметры = await searchParams;
  const строка = new URLSearchParams();
  for (const [ключ, значение] of Object.entries(параметры ?? {})) {
    const v = Array.isArray(значение) ? значение[0] : значение;
    if (typeof v === "string" && v !== "") строка.set(ключ, v);
  }
  const хвост = строка.toString();
  redirect("/multichat-engine" + (хвост ? "?" + хвост : ""));
}
