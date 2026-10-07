import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /rd — КОРОТКИЙ вход Reddit: его кладёт набор запуска, потому что channelParam
// отдаёт первый ключ с этим значением. Длинный /reddit оставлен рядом: его
// набирают руками. Обе метки означают один канал «reddit».
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const метка = меткаДляПерехода((await searchParams).c, "rd");
  if (метка !== "rd") redirect(`/en/devhub?c=${метка}`);
  redirect("/en/devhub?c=rd");
}
