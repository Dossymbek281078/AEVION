// /cyberchess/guide — русская версия страницы о тренере (en и kk — свои адреса).
import GuideView from "./GuideView";
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { redirect } from "next/navigation";
import { serverLang } from "@/lib/serverLang";
import { keepChannelOrProbe, channelFrom } from "@/lib/products";
import { guideMetadata, guideUrl, GUIDE_LANGUAGES } from "./guide";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...guideMetadata("ru"),
  alternates: { canonical: guideUrl("ru"), languages: GUIDE_LANGUAGES },
};

/*
 * 5.11.2026 (замер прода 3c9b2d343): en-браузер на /cyberchess/guide видел 51 русскую строку, хотя
 * /en/cyberchess/guide и /kk/… есть. Язык — как у /cyberchess/traps (serverLang), метка канала едет дальше.
 */
export default async function CcGuidePageRu({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const язык = await serverLang("ru");
  if (язык === "en" || язык === "kk") {
    const c = (await searchParams).c;
    redirect(keepChannelOrProbe(`/${язык}/cyberchess/guide`, c, channelFrom(c)));
  }
  return (
    <>
      <PageTracking page="cyberchess-guide" />
      <GuideView yazyk="ru" />
    </>
  );
}
