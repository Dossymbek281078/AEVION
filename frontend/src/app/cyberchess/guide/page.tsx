// /cyberchess/guide — русская версия страницы о тренере (en и kk — свои адреса).
import GuideView from "./GuideView";
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { guideMetadata, guideUrl, GUIDE_LANGUAGES } from "./guide";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...guideMetadata("ru"),
  alternates: { canonical: guideUrl("ru"), languages: GUIDE_LANGUAGES },
};

export default function CcGuidePageRu() {
  return (
    <>
      <PageTracking page="cyberchess-guide" />
      <GuideView yazyk="ru" />
    </>
  );
}
