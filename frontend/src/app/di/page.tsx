import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Короткий адрес закрыт от поисковика, как /sh: это вход для человека из
// подписи ролика, а не страница — в выдаче ему соревноваться не с чем.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

/*
 * /di — Instagram → DevHub: короткий адрес для подписи ИИ-ведущей Ави.
 *
 * ЗАЧЕМ (12.10.2026, просьба окна ИИ-блогера, согласована оркестратором).
 * В подписях TikTok и Instagram ссылки не кликаются — человек набирает адрес
 * руками. Полный адрес с меткой он не наберёт, а без метки канал не посчитать:
 * переход ляжет в «прямые заходы», и на вопрос «сработал ли ролик» ответа не
 * будет. Ровно так 29.09 стали неизмеримы переходы с Product Hunt.
 *
 * Ведём на РУССКУЮ страницу (без /en): ролики Ави русские. /sh ведёт на /en —
 * там каталог английский, здесь другое.
 *
 * Метка ig-blogger-bio распознаётся продом: channelFrom → instagram, postFrom → blogger-bio
 * (проверено окном ИИ-блогера 12.10).
 */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const метка = меткаДляПерехода((await searchParams).c, "ig-blogger-bio");
  redirect(`/devhub?c=${метка}`);
}
