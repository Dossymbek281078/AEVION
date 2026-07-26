// QSkyway — regulator permission regimes, the second kind of published rule.
//
// The ceiling layer (qskyway.airspace.ts) answers "how high may this corridor
// fly here". This one answers a different question the same regulators also
// publish: "may the flight happen at all without an individual permission".
//
// They are deliberately NOT merged. A ceiling constrains the route geometry and
// belongs in the router; a permission regime constrains the operation and
// belongs on the paperwork. Folding one into the other would either invent an
// altitude Japan never published, or hide a legal gate behind a number.
//
// The distinction also keeps the honesty tractable per city:
//   NYC   — ceilings, ingested as vectors from the FAA feed
//   Tokyo — no ceiling grid published; a permission regime, read from MLIT's own
//           raster layer, covering the whole twin
//   Astana— neither found
//
// `basis` records HOW the value was obtained, because "the authority publishes
// this" and "we sampled the authority's map image" are different strengths of
// claim and the platform's provenance vocabulary exists to keep them apart.

import { PERMISSION_TOKYO } from "./qskyway.permission.tokyo";

export interface CityPermission {
  authority: string;
  source: string;
  sourceUrl: string;
  /** the rule in one line, as the law states it */
  regime: string;
  /** how the figure was obtained — "ingested" (vector data) or "raster-sampled" */
  basis: "ingested" | "raster-sampled";
  effective: string;
  sampled: string;
  sampledCells: number;
  cellsRequiringPermission: number;
  /** share of the twin under the regime, 0–100 */
  coveragePct: number;
}

export const PERMISSION: Record<string, CityPermission> = { tokyo: PERMISSION_TOKYO };

export function permissionSummary(cityId: string) {
  const p = PERMISSION[cityId];
  if (!p) return { available: false as const };
  // A uniform result is reported as such rather than dressed up as a map: when
  // the whole twin is inside the regime there is nothing to route around, and
  // saying so is more useful than a per-cell layer with one value in it.
  const uniform = p.coveragePct >= 99.9;
  return {
    available: true as const,
    authority: p.authority,
    source: p.source,
    sourceUrl: p.sourceUrl,
    regime: p.regime,
    basis: p.basis,
    effective: p.effective,
    sampled: p.sampled,
    coveragePct: p.coveragePct,
    uniform,
    note: uniform
      ? "Весь твин попадает под режим: каждый полёт здесь требует индивидуального разрешения. Обходить нечего — это условие операции, а не геометрии маршрута."
      : `Под режим попадает ${p.coveragePct}% твина — часть полётов требует индивидуального разрешения.`,
    provenanceNote:
      p.basis === "raster-sampled"
        ? "Значение получено выборкой по опубликованным растровым тайлам регулятора в центрах ячеек сетки, а не из векторного датасета — регулятор публикует этот слой только картой."
        : "Значение загружено из векторной публикации регулятора.",
  };
}
