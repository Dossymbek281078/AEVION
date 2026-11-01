// /kk/cyberchess/traps — тұзақтар бетінің қазақша нұсқасы.
import TrapsView from "../../../cyberchess/traps/TrapsView";
import type { Metadata } from "next";
import { trapsMetadata, trapsUrl, TRAPS_LANGUAGES } from "../../../cyberchess/traps/meta";

// canonical lives on the page itself: the canonicalNotInherited guard reads page.tsx.
export const metadata: Metadata = {
  ...trapsMetadata("kk"),
  alternates: { canonical: trapsUrl("kk"), languages: TRAPS_LANGUAGES },
};

export default function TrapsPageKk() {
  return <TrapsView yazyk="kk" />;
}
