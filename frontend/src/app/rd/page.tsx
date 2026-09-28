import { redirect } from "next/navigation";

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
export const dynamic = "force-static";

export default function Page() {
  redirect("/en/devhub?c=rd");
}
