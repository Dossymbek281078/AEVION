import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /ads-multichat — короткий адрес: платное объявление про Multichat.
//
// 28.09.2026: метка заведена в CHANNELS в тот же день. Ведём не на общий /go, а
// на /multichat-engine — как /hn и /ph: человек из объявления должен попасть туда, о чём
// объявление. Метка доносится до кассы и до учёта воронки.
export const dynamic = "force-static";

export default function Page() {
  redirect("/multichat-engine?c=ads-multichat");
}
