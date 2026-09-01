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
  /*
   * Подписи, которые видит человек. Все до одной живут ЗДЕСЬ, а не строками в
   * разметке: компонент общий, им пользуются три страницы, и зашитое слово
   * доезжает до всех сразу.
   *
   * ⚠️ 01.09.2026: тут было зашито ПО-РУССКИ семь мест. Сторож языка нашёл
   * ОДНО — остальные шесть живут в подсказке (атрибут text у InfoTip) и на
   * экран попадают только при наведении, то есть его охвату недоступны.
   * Граница сторожа честная, но полагаться на неё нельзя: он видит подпись
   * и не видит пояснение к ней.
   */
  /** Доля реальных данных: «50.1 % реальных». */
  real: string;
  /** Пояснение к трём уровням, показывается по наведению. */
  tipMeasured: string;
  tipDerived: string;
  tipGuessed: string;
  /** «Источник: …» и «Всего: …» в той же подсказке. */
  tipSource: string;
  tipTotal: string;
  /** Подпись самой подсказки для читалки экрана. */
  tipLabel: string;
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
  /*
   * ⚠️ 01.09.2026: слово «реальных» было ЗАШИТО ПО-РУССКИ прямо в разметке
   * DataProvenanceChip — рядом с `measured`, который переводится и настраивается.
   *
   * На английской странице человек читал: «96% measured, 50.1% реальных».
   * Половина фразы на его языке, половина на чужом.
   *
   * Нашлось сторожем языка QSkyway: строка была ОДИНАКОВА в русской и английской
   * отрисовке — именно потому, что русская половина не менялась по определению.
   * Сторож поймал верно, а причина оказалась не та, на которую мы смотрели
   * сначала (думали про потерянную подстановку).
   *
   * Компонент общий: им пользуется не один модуль, поэтому подпись живёт здесь,
   * рядом с остальными, а не строкой в разметке.
   */
  real: "реальных",
  tipMeasured: "реальный замер/запись",
  tipDerived: "выведено из смежного сигнала",
  tipGuessed: "дефолт-заглушка",
  tipSource: "Источник",
  tipTotal: "Всего",
  tipLabel: "Провенанс данных",
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
