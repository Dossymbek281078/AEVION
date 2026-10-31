// /kk/multichat-engine/compare — «ChatGPT, Claude әлде Gemini» бетінің қазақша нұсқасы.
import CompareView from "../../../multichat-engine/compare/CompareView";
import type { Metadata } from "next";
import { compareMetadata, compareUrl, COMPARE_LANGUAGES } from "../../../multichat-engine/compare/meta";

// canonical lives on the page itself: the canonicalNotInherited guard reads page.tsx.
export const metadata: Metadata = {
  ...compareMetadata("kk"),
  alternates: { canonical: compareUrl("kk"), languages: COMPARE_LANGUAGES },
};

export default function ComparePageKk() {
  return <CompareView yazyk="kk" />;
}
