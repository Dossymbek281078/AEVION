import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /li — короткий адрес для подписи в LinkedIn.
//
// 15.09.2026: метка «li» появилась в каталоге CHANNELS (выкатка 970e30d1d72e),
// а страницы-входа к ней не было — сторож everyChannelHasShortEntry краснел на
// выкаченном коде, и ссылка из объявления дала бы 404. Устройство то же, что
// у /ig: никакой логики, только перенаправление с меткой.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const метка = меткаДляПерехода((await searchParams).c, "li");
  if (метка !== "li") redirect(`/go?c=${метка}`);
  redirect("/go?c=li");
}
