// AEVION Data Provenance Layer — one shared vocabulary for "how trustworthy is
// this data" across every module that shows figures derived from external sources.
//
// The pattern was born in QSkyway (building-height provenance: measured from a 3D
// city model vs. derived from floor counts vs. guessed by default) and is lifted
// here so the whole platform can speak the same language: what is provable, what
// is inferred, what is a placeholder. Regulators and investors ask for exactly
// this, and stating it up front is the antidote to "over-promising" in pitches.
//
// Tiers (deliberately only three — more nuance reads as noise on a chip):
//   measured — hard fact: a real measurement / verified record / survey-grade value
//   derived  — inferred from a related signal (a formula, a proxy, a model)
//   guessed  — a default / placeholder used because nothing better was available
//
// Modules keep their own domain words via `labels` on the chip (Smeta: "реальная
// расценка / интерполяция / дефолт"; QVenture: "факт / оценка / допущение"), but
// the SHAPE is always this one, so a single <DataProvenanceChip> renders them all.

export interface DataQuality {
  total: number;
  measured: number;
  derived: number;
  guessed: number;
  /** 100 * measured / total (rounded to 0.1) */
  measuredPct: number;
  /** 100 * (measured + derived) / total — everything that is not a pure guess */
  realPct: number;
  /** free-text origin, e.g. "OSM footprints + PLATEAU LOD2 (MLIT)" */
  source?: string;
  /** short human note on what each tier means for this module */
  note?: string;
}

export type ProvenanceTier = "measured" | "derived" | "guessed";

/** Words shown on the chip. Defaults suit QSkyway; other modules override. */
export interface ProvenanceLabels {
  measured: string;
  derived: string;
  guessed: string;
  /** unit of the counted thing, e.g. "зданий", "позиций" (optional) */
  unit?: string;
}

export const DEFAULT_PROVENANCE_LABELS: ProvenanceLabels = {
  measured: "измерено",
  derived: "выведено",
  guessed: "угадано",
};

/** Semantic colours shared with the rest of the platform (teal/amber/rose). */
export const PROVENANCE_COLORS: Record<ProvenanceTier, string> = {
  measured: "#2dd4bf",
  derived: "#fbbf24",
  guessed: "#fb7185",
};

/** Build a DataQuality summary from raw tier counts (keeps rounding consistent). */
export function dataQualityFromCounts(
  measured: number,
  derived: number,
  guessed: number,
  extra?: { source?: string; note?: string },
): DataQuality {
  const total = measured + derived + guessed;
  const pct = (n: number) => (total ? Math.round((1000 * n) / total) / 10 : 0);
  return {
    total,
    measured,
    derived,
    guessed,
    measuredPct: pct(measured),
    realPct: pct(measured + derived),
    source: extra?.source,
    note: extra?.note,
  };
}

/** Traffic-light tone for a measured-% headline (>=60 good, >=25 warn, else weak). */
export function provenanceTone(measuredPct: number): string {
  return measuredPct >= 60
    ? PROVENANCE_COLORS.measured
    : measuredPct >= 25
      ? PROVENANCE_COLORS.derived
      : PROVENANCE_COLORS.guessed;
}
