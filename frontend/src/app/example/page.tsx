import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /example — короткий адрес для постов и роликов про галерею примеров DevHub.
//
// 06.10.2026. Повод конкретный: в галерею добавлен пример с ЗАМЕРЕННЫМ временем
// (фраза → живой адрес за 34 с, замер того же дня на живом проде). Посты ведут
// на /devhub?c=example, и без короткого входа ссылка в объявлении дала бы 404 —
// ровно то, что случилось с /fb в замере 30.08: метка работала, страницы не было.
//
// Ведём на /devhub, а не на общий /go: объявление про DevHub, и человек должен
// попасть туда, о чём объявление (как /hn и /ph).
export const dynamic = "force-static";

export default function Page() {
  redirect("/devhub?c=example");
}
