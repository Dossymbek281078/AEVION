import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они решают отдельную задачу: закрыть его от поисковика.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /ads-devhub — короткий адрес для метки воронки «платная кампания про DevHub».
//
// ЗАЧЕМ. Метку завело соседнее окно 28.09.2026 (посты X и бриф платной
// кампании ведут на ?c=ads-devhub), а короткого адреса к ней не было — и сторож
// everyChannelHasShortEntry.test.ts покраснел: метка в каталоге есть, а
// /ads-devhub отвечал бы 404. Для платной кампании это прямая потеря: объявление
// оплачено, переход по короткому адресу не доходит.
//
// Страница ничего не решает — только доносит СВОЮ метку до целевой страницы,
// которая читает ?c= через channelFrom.
export const dynamic = "force-static";

export default function Page() {
  redirect("/devhub?c=ads-devhub");
}
