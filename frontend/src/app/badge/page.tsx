import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /badge — короткий адрес: бейдж «Сделано в AEVION» на сайтах, опубликованных DevHub.
//
// 28.09.2026: метка заведена в CHANNELS в тот же день. Ведём не на общий /go, а
// на /devhub — как /hn и /ph: человек из объявления должен попасть туда, о чём
// объявление. Метка доносится до кассы и до учёта воронки.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const метка = меткаДляПерехода((await searchParams).c, "badge");
  if (метка !== "badge") redirect(`/devhub?c=${метка}`);
  redirect("/devhub?c=badge");
}
