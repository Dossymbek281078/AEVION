import { redirect } from "next/navigation";

import { меткаДляПерехода, хвостПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они решают отдельную задачу: закрыть его от поисковика.
// Короткий адрес — это вход для человека из подписи под роликом, а не
// страница: в выдаче ему делать нечего, и без noindex он соревновался бы за
// показы с той страницей, на которую ведёт.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /ch-a — короткий вход безликого YouTube-канала A (Shorts), 4.11.2026, решение Оркестратора.
// Устроен как /yt: только перенаправление на /go с меткой канала; ch-a-NN едет дальше как пост.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const параметры = await searchParams;
  const метка = меткаДляПерехода(параметры.c, "ch-a");
  const хвост = хвостПерехода(параметры);
  if (метка !== "ch-a" || хвост) redirect(`/go?c=${метка}${хвост}`);
  redirect("/go?c=ch-a");
}
