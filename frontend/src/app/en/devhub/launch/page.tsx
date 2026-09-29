import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION DevHub" },
  robots: { index: false, follow: true },
};

/*
 * /en/devhub/launch — англоязычный вход на страницу запуска.
 *
 * 29.09.2026: адрес отвечал 404 — страница запуска существовала только на русском
 * пути. Ссылку /en/devhub/launch естественно набрать или прислать человеку с
 * Product Hunt, и 404 на ней — потерянный посетитель без единого следа в учёте.
 * Метку канала переносим: без неё переход дойдёт живым, но уйдёт в «unattributed».
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
  redirect("/devhub/launch" + (хвост ? "?" + хвост : ""));
}
