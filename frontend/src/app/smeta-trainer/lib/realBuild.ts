/**
 * Чистый расчётный слой для режима «Своя смета из реальных позиций» (/real-rates/assemble).
 * Без React и сайд-эффектов — легко тестируется (см. realBuild.test.ts).
 *
 * Семантика данных Формы 4 (проверено на real-rates.json):
 *   resource.total — стоимость ресурса на ВСЮ позицию (Σ по видам ≈ position.total).
 *   ⇒ стоимость вида на единицу = resource.total / position.qty.
 */

export const KINDS = ["труд", "машины", "материал", "перевозка"] as const;
export type Kind = (typeof KINDS)[number];

export interface ResourceLite {
  kind: string;
  total: number;
}
export interface PositionLite {
  n: number;
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
  resources?: ResourceLite[];
}
export interface SmetaLite {
  sheet: string;
  smetaNo: string | null;
  object: string | null;
  totals?: Record<string, number | null>;
  positions: PositionLite[];
}

export interface BasketItem {
  uid: string;
  sheet: string;
  n: number;
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  qty: number;
  /** стоимость каждого вида ресурса на единицу позиции */
  kindPerUnit: Record<Kind, number>;
}

export interface KindTotals {
  all: number;
  byKind: Record<Kind, number>;
}

function emptyKinds(): Record<Kind, number> {
  return { "труд": 0, "машины": 0, "материал": 0, "перевозка": 0 };
}

/** Стоимость каждого вида ресурса на ЕДИНИЦУ позиции (kindTotal / qty). */
export function kindPerUnitOf(pos: PositionLite): Record<Kind, number> {
  const out = emptyKinds();
  const q = pos.qty || 1; // защита от деления на 0
  for (const r of pos.resources ?? []) {
    if ((KINDS as readonly string[]).includes(r.kind)) {
      out[r.kind as Kind] += (r.total || 0) / q;
    }
  }
  return out;
}

/** Итоги собранной сметы: всего (Σ цена×объём) + разбивка по видам. */
export function basketTotals(basket: BasketItem[]): KindTotals {
  const byKind = emptyKinds();
  let all = 0;
  for (const b of basket) {
    all += b.unitPrice * b.qty;
    for (const k of KINDS) byKind[k] += (b.kindPerUnit[k] || 0) * b.qty;
  }
  return { all, byKind };
}

export interface FactTotals {
  всего: number | null;
  "труд": number | null;
  "машины": number | null;
  "перевозки": number | null;
}

/**
 * Эталонные итоги реальной ЛС (из шапки сметы), для сравнения «моя смета vs факт».
 * В totals реальной выгрузки нет строки «материал» — поэтому только эти 4 ключа.
 */
export function realFactTotals(smeta: SmetaLite): FactTotals {
  const t = smeta.totals ?? {};
  return {
    всего: t["всего"] ?? null,
    "труд": t["труд"] ?? null,
    "машины": t["машины"] ?? null,
    "перевозки": t["перевозки"] ?? null,
  };
}

/** Процент совпадения моей суммы с фактом (100% при равенстве, 0 если факта нет). */
export function matchPercent(mine: number, fact: number | null): number | null {
  if (fact == null || fact === 0) return null;
  return (mine / fact) * 100;
}
