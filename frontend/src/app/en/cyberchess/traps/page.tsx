// /en/cyberchess/traps — English version of the opening traps page.
import TrapsView from "../../../cyberchess/traps/TrapsView";
import type { Metadata } from "next";
import { PageTracking } from "@/components/PageTracking";
import { trapsMetadata, trapsUrl, TRAPS_LANGUAGES } from "../../../cyberchess/traps/meta";

// canonical lives on the page itself: the canonicalNotInherited guard reads page.tsx.
export const metadata: Metadata = {
  ...trapsMetadata("en"),
  alternates: { canonical: trapsUrl("en"), languages: TRAPS_LANGUAGES },
};

export default function TrapsPageEn() {
  return (
    <>
      <PageTracking page="en-cyberchess-traps" />
      <TrapsView yazyk="en" />
    </>
  );
}
