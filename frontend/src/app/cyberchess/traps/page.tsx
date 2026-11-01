// /cyberchess/traps — русская версия страницы ловушек (en и kk — свои адреса).
import TrapsView from "./TrapsView";
import type { Metadata } from "next";
import { trapsMetadata, trapsUrl, TRAPS_LANGUAGES } from "./meta";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...trapsMetadata("ru"),
  alternates: { canonical: trapsUrl("ru"), languages: TRAPS_LANGUAGES },
};

export default function TrapsPageRu() {
  return <TrapsView yazyk="ru" />;
}
