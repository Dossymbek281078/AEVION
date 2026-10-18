import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Перенаправление закрыто от поисковика (как у /sh, /fz): короткий адрес — вход, не страница.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /wa — короткий вход для писем в WhatsApp (18.10.2026, слово оркестратора): школам и клубам уходят метки
// wa-school-<город>. Сторож everyChannelHasShortEntry требует у каждого ключа каталога свой короткий адрес,
// иначе ссылка в подписи даст 404. Ведём на шахматы: письма школам — о неделе шахмат (0-ШАХМАТЫ-НЕДЕЛЯ 13.10);
// полная метка из письма (?c=wa-school-almaty) доносится как есть через меткаДляПерехода.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const метка = меткаДляПерехода((await searchParams).c, "wa");
  if (метка !== "wa") redirect(`/cyberchess?c=${метка}`);
  redirect("/cyberchess?c=wa");
}
