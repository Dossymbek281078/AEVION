import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они решают отдельную задачу: закрыть его от поисковика.
export const metadata: Metadata = {
  title: "AEVION",
  robots: { index: false, follow: true },
};

// /en/yt — короткий адрес для описания под АНГЛИЙСКИМ роликом на YouTube.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ОТ /en/tt. Метка канала в них разная, и без неё переход с
// YouTube смешается с TikTok в одну кучу «social». Замер 28.08.2026 показал,
// чем это кончается: у опубликованных английских роликов в кадре стоял
// /en/go без метки вовсе, и весь их трафик пришёл бы как «источник
// неизвестен».
//
// Русский /yt уже был, английского не было — нашлось при проверке ссылок,
// которые я собирался положить в описания роликов.
export const dynamic = "force-static";

export default function Page() {
  redirect("/en/go?c=yt");
}
