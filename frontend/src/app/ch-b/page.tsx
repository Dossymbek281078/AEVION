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

// /ch-b — короткий вход безликого YouTube-канала B (Shorts), 4.11.2026, решение Оркестратора.
// Устроен как /yt, но ведёт на /devhub (5.11), не на /go; ch-b-NN едет дальше как пост.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const параметры = await searchParams;
  const метка = меткаДляПерехода(параметры.c, "ch-b");
  const хвост = хвостПерехода(параметры);
  // 5.11.2026 (Оркестратор): не общий /go, а /devhub — зритель канала B про ИИ-инструменты — сразу DevHub; метка ch-b(-NN) едет дальше.
  if (метка !== "ch-b" || хвост) redirect(`/devhub?c=${метка}${хвост}`);
  redirect("/devhub?c=ch-b");
}
