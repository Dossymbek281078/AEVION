// /kk/cyberchess/guide — казахская версия страницы о тренере.
import GuideView from "../../../cyberchess/guide/GuideView";
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { guideMetadata, guideUrl, GUIDE_LANGUAGES } from "../../../cyberchess/guide/guide";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...guideMetadata("kk"),
  alternates: { canonical: guideUrl("kk"), languages: GUIDE_LANGUAGES },
};

export default function CcGuidePageKk() {
  return (
    <>
      <PageTracking page="kk-cyberchess-guide" />
      <GuideView yazyk="kk" />
    </>
  );
}
