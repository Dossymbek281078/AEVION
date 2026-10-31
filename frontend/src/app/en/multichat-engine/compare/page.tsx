// /en/multichat-engine/compare — English version of the "ChatGPT vs Claude vs Gemini" page.
import CompareView from "../../../multichat-engine/compare/CompareView";
import type { Metadata } from "next";
import { compareMetadata, compareUrl, COMPARE_LANGUAGES } from "../../../multichat-engine/compare/meta";

// canonical lives on the page itself: the canonicalNotInherited guard reads page.tsx.
export const metadata: Metadata = {
  ...compareMetadata("en"),
  alternates: { canonical: compareUrl("en"), languages: COMPARE_LANGUAGES },
};

export default function ComparePageEn() {
  return <CompareView yazyk="en" />;
}
