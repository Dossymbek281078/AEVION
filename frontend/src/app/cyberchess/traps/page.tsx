// /cyberchess/traps — русская версия страницы ловушек (en и kk — свои адреса).
import TrapsView from "./TrapsView";
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { trapsMetadata, trapsUrl, TRAPS_LANGUAGES } from "./meta";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...trapsMetadata("ru"),
  alternates: { canonical: trapsUrl("ru"), languages: TRAPS_LANGUAGES },
};

export default function TrapsPageRu() {
  return (
    <>
      <PageTracking page="cyberchess-traps" />
      <TrapsView yazyk="ru" />
    </>
  );
}
