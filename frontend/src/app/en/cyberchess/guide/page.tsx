// /en/cyberchess/guide — английская версия страницы о тренере.
import GuideView from "../../../cyberchess/guide/GuideView";
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { guideMetadata, guideUrl, GUIDE_LANGUAGES } from "../../../cyberchess/guide/guide";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...guideMetadata("en"),
  alternates: { canonical: guideUrl("en"), languages: GUIDE_LANGUAGES },
};

export default function CcGuidePageEn() {
  return (
    <>
      <PageTracking page="en-cyberchess-guide" />
      <GuideView yazyk="en" />
    </>
  );
}
