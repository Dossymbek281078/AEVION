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


// /en/tt — короткий адрес для подписи под АНГЛИЙСКИМ роликом в TikTok.
// Тот же приём, что у русского /tt: метка канала доезжает даже когда адрес
// набирают руками, а не переходят по ссылке из шапки профиля.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const параметры = await searchParams;
  const метка = меткаДляПерехода(параметры.c, "tt");
  const хвост = хвостПерехода(параметры);
  if (метка !== "tt" || хвост) redirect(`/en/go?c=${метка}${хвост}`);
  redirect("/en/go?c=tt");
}
