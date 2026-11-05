// /cyberchess/traps — русская версия страницы ловушек (en и kk — свои адреса).
import TrapsView from "./TrapsView";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageTracking } from "@/components/PageTracking";
import { serverLang } from "@/lib/serverLang";
import { keepChannelOrProbe, channelFrom } from "@/lib/products";
import { trapsMetadata, trapsUrl, TRAPS_LANGUAGES, TRAPS_PATHS } from "./meta";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...trapsMetadata("ru"),
  alternates: { canonical: trapsUrl("ru"), languages: TRAPS_LANGUAGES },
};

/*
 * 4.11.2026 (решение Оркестратора, замер прода 9ca100905): англоязычный браузер на /cyberchess/traps
 * получал русскую страницу (84 видимые русские строки), хотя /en/cyberchess/traps и /kk/… есть, а
 * /cyberchess сам переключается на язык браузера. Язык — как у остальных серверных страниц
 * (serverLang: ?lang= → кука aevion_lang_v1 → Accept-Language → ru); метка канала едет дальше.
 */
export default async function TrapsPageRu({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const язык = await serverLang("ru");
  if (язык === "en" || язык === "kk") {
    const c = (await searchParams).c;
    redirect(keepChannelOrProbe(TRAPS_PATHS[язык], c, channelFrom(c)));
  }
  return (
    <>
      <PageTracking page="cyberchess-traps" />
      <TrapsView yazyk="ru" />
    </>
  );
}
