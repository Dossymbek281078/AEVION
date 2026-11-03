// /devhub/guide — страница для разработчиков из поиска («AI app builder»), ведёт в студию DevHub и в цены.
// Язык — serverLang (?lang=, кука, Accept-Language); en/ru/kk (kk — черновик).
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { serverLang } from "@/lib/serverLang";
import { GuideView } from "./GuideView";
import { GUIDE_LANGUAGES, guideLang, guideMetadata } from "./guideText";

export const dynamic = "force-dynamic";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
// Свой для каждого языка (= его адрес в hreflang): canonical на общий адрес при
// hreflang на ?lang=xx поисковик считает противоречием и отбрасывает языковые версии.
export async function generateMetadata(): Promise<Metadata> {
  const lang = guideLang(await serverLang("ru"));
  return {
    ...guideMetadata(lang),
    alternates: { canonical: GUIDE_LANGUAGES[lang], languages: GUIDE_LANGUAGES },
  };
}

export default async function DevhubGuidePage() {
  const lang = guideLang(await serverLang("ru"));
  return (
    <>
      <PageTracking page="devhub-guide" />
      <GuideView lang={lang} />
    </>
  );
}
