// /multichat-engine/compare — русская версия страницы «Claude, Gemini и открытая модель» (en и kk — свои адреса).
import CompareView from "./CompareView";
import type { Metadata } from "next";
import { compareMetadata, compareUrl, COMPARE_LANGUAGES } from "./meta";

// canonical объявлен на самой странице: сторож canonicalNotInherited читает page.tsx.
export const metadata: Metadata = {
  ...compareMetadata("ru"),
  alternates: { canonical: compareUrl("ru"), languages: COMPARE_LANGUAGES },
};

export default function ComparePageRu() {
  return <CompareView yazyk="ru" />;
}
