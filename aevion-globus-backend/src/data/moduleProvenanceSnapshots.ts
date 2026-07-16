// Build-time provenance snapshots for modules whose source data lives in the
// frontend and is therefore NOT present on the backend host (Railway deploys
// only aevion-globus-backend/). Each snapshot mirrors counts a frontend module
// already computes, so the AEVION Trust Score can include it.
//
// These are point-in-time copies: `capturedAt` records when, and `sourceGeneratedAt`
// carries the upstream data's own timestamp. When the upstream corpus changes,
// re-capture the counts here. Kept deliberately tiny (counts + metadata only) so
// there is nothing to drift except the numbers themselves.

export interface ProvenanceSnapshot {
  /** tier-0 count: real / measured / verified items */
  measured: number;
  /** tier-1 count: derived / inferred items */
  derived: number;
  /** tier-2 count: guessed / placeholder items */
  guessed: number;
  source: string;
  /** upstream data's own generation timestamp, if any */
  sourceGeneratedAt?: string;
  /** when these counts were copied into the backend */
  capturedAt: string;
  note?: string;
}

export const PROVENANCE_SNAPSHOTS: Record<string, ProvenanceSnapshot> = {
  // Smeta trainer — share of educational materials priced from the REAL ССЦ РК
  // price book vs. an educational fallback. Mirrors materialMapMeta
  // (frontend/src/app/smeta-trainer/data/material-ssc-map.json).
  "smeta-trainer": {
    measured: 163, // matched to real ССЦ РК 8.04-08-2025 entries
    derived: 0, // no middle tier — a material is either book-priced or a fallback
    guessed: 91, // educational fallback price
    source: "ССЦ РК 8.04-08-2025 (almaty) via material-ssc-map.json",
    sourceGeneratedAt: "2026-05-08T05:12:49Z",
    capturedAt: "2026-07-16",
    note: "доля учебных материалов с реальной ценой из сборника ССЦ РК против учебного fallback.",
  },
};
