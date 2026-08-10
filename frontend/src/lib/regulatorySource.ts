// AEVION Regulatory Source Layer — the second axis of trust.
//
// DataProvenanceChip (see ./dataQuality) answers "how was this NUMBER obtained —
// measured, derived, or guessed?". That is the right question for figures.
//
// It is the wrong question for RULES. A no-fly radius, a price index, a legal
// clause, a building code limit is not measured or estimated — it is either what
// an authority actually publishes, or a plausible-looking placeholder someone
// wrote to make a demo work. Those two look identical on screen and are worlds
// apart in what they let you claim. QSkyway hit this directly: its wind became a
// real METAR observation and its NYC ceilings a real FAA publication, while its
// point no-fly zones stayed invented — and nothing in the UI distinguished them.
//
// So: one shared vocabulary for whose rule this is.
//
//   official      — published by the naming authority, ingested as-is, citable
//   illustrative  — plausible placeholder, ours, NOT sourced from any authority
//   none          — no rule applied here, and we are not pretending otherwise
//
// The honest default is `illustrative`, not `official`: a module that has not
// stated its source has not earned the badge.

export type RegulatoryTier = "official" | "illustrative" | "none";

export interface RegulatorySource {
  tier: RegulatoryTier;
  /** the naming authority, e.g. "FAA", "ССЦ РК", "EASA" — required for `official` */
  authority?: string;
  /** what the document/feed is called, e.g. "UAS Facility Map" */
  title?: string;
  /** edition/effective date as the authority states it */
  effective?: string;
  /**
   * The limit of what this source actually authorizes. Every `official` source
   * has one, and hiding it is how a real citation turns into an overclaim —
   * e.g. FAA UASFM is a small-UAS grid, not eVTOL certification.
   */
  scopeNote?: string;
  /** snapshot still matches what the authority publishes (null = not checked) */
  upToDate?: boolean | null;
  /**
   * Edition the authority publishes RIGHT NOW, when a live check answered.
   *
   * Not the same question as `upToDate`. The FAA reissues UAS Facility Maps on
   * a cycle; a reissue that leaves every ceiling untouched is not drift — the
   * numbers we route against are still correct — but the edition has moved.
   * Checked live on 2026-08-10: our snapshot is the 7/9/2026 edition, the feed
   * publishes 8/6/2026, zero cells changed. Saying "the snapshot matches what
   * the regulator publishes" there is literally false, and this is a chip whose
   * entire job is to be defensible. So the two facts are carried separately and
   * the chip states the narrower, true one.
   */
  publishedEffective?: string | null;
  /** cryptographically attested (e.g. Ed25519 over the ingested rule set) */
  attested?: boolean;
}

export const REGULATORY_COLORS: Record<RegulatoryTier, string> = {
  official: "#2dd4bf",
  illustrative: "#fbbf24",
  none: "#5f7086",
};

export interface RegulatoryLabels {
  official: string;
  illustrative: string;
  none: string;
}

export const DEFAULT_REGULATORY_LABELS: RegulatoryLabels = {
  official: "официальный источник",
  illustrative: "иллюстративно",
  none: "источника нет",
};

/**
 * A source claiming `official` without naming its authority is not official —
 * it is an unlabeled placeholder, and the chip must show it as such rather than
 * award a green badge to an empty claim.
 */
export function effectiveTier(src: RegulatorySource | null | undefined): RegulatoryTier {
  if (!src) return "none";
  if (src.tier === "official" && !src.authority) return "illustrative";
  return src.tier;
}

/** One-line summary used as the chip's own text. */
export function regulatoryHeadline(src: RegulatorySource | null | undefined, labels?: Partial<RegulatoryLabels>): string {
  const L = { ...DEFAULT_REGULATORY_LABELS, ...labels };
  const tier = effectiveTier(src);
  if (tier === "none") return L.none;
  if (tier === "illustrative") return L.illustrative;
  return src?.authority ? `${src.authority}${src.title ? " · " + src.title : ""}` : L.official;
}
