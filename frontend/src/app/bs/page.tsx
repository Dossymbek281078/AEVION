import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они закрывают его от поисковика — см. /ig.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /bs — короткий адрес для подписи в Bluesky.
//
// 15.09.2026: метка «bs» появилась в каталоге CHANNELS (выкатка 970e30d1d72e),
// а страницы-входа к ней не было — сторож everyChannelHasShortEntry краснел на
// выкаченном коде, и ссылка из объявления дала бы 404. Устройство то же, что
// у /ig: никакой логики, только перенаправление с меткой.
export const dynamic = "force-static";

export default function Page() {
  redirect("/go?c=bs");
}
