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

/* ─────────────────────────── Позиционный разбор расхождений ────────────────────────────
 * Агрегатной сверки мало: студент видит «−2 млн ₸», но не знает, ЧТО именно не сошлось.
 * reconcilePositions сопоставляет мою смету с эталонной ЛС по шифру расценки и для каждой
 * позиции определяет статус: сошлось / неверный объём / неверная расценка / пропущена / лишняя.
 */

export type DiffStatus = "ok" | "qty" | "price" | "missing" | "extra";

export interface PositionDiff {
  code: string;
  name: string;
  unit: string;
  status: DiffStatus;
  /** объём в эталоне (Σ по одинаковым шифрам); null — позиции нет в эталоне */
  factQty: number | null;
  /** мой объём (Σ по корзине); null — позиции нет в корзине */
  mineQty: number | null;
  factUnitPrice: number | null;
  mineUnitPrice: number | null;
  /** сумма в эталоне (Σ position.total) / моя (Σ цена×объём) */
  factSum: number | null;
  mineSum: number | null;
  /** человекочитаемое пояснение для панели и журнала */
  note: string;
}

export interface Reconciliation {
  rows: PositionDiff[];
  counts: Record<DiffStatus, number>;
  /** доля «сошлось» среди эталонных позиций, % (null — в эталоне нет позиций) */
  matchedPct: number | null;
}

/** Равенство с допуском: абсолютным (мелочь) ИЛИ относительным (масштаб). */
export function approxEqual(a: number, b: number, rel = 0.005, abs = 0.5): boolean {
  const diff = Math.abs(a - b);
  if (diff <= abs) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale > 0 && diff / scale <= rel;
}

interface Agg {
  code: string;
  name: string;
  unit: string;
  qty: number;
  sum: number;
}

function aggFact(smeta: SmetaLite): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const p of smeta.positions) {
    const a = m.get(p.code) ?? { code: p.code, name: p.name, unit: p.unit, qty: 0, sum: 0 };
    a.qty += p.qty || 0;
    a.sum += p.total || 0;
    m.set(p.code, a);
  }
  return m;
}

function aggMine(basket: BasketItem[], sheet: string): Map<string, Agg> {
  const m = new Map<string, Agg>();
  // только позиции, относящиеся к сверяемой ЛС (по листу) — остальные пойдут в «лишние»
  for (const b of basket.filter((x) => x.sheet === sheet)) {
    const a = m.get(b.code) ?? { code: b.code, name: b.name, unit: b.unit, qty: 0, sum: 0 };
    a.qty += b.qty || 0;
    a.sum += b.unitPrice * b.qty;
    m.set(b.code, a);
  }
  return m;
}

function unitPriceOf(a: Agg): number {
  return a.qty > 0 ? a.sum / a.qty : 0;
}

/**
 * Сопоставляет мою смету с эталонной ЛС позиционно.
 * Сверяются только позиции того же листа (b.sheet === smeta.sheet) — каждая ЛС сверяется
 * независимо; позиции из других ЛС в корзине в этой сверке не участвуют. «Лишняя» (extra) —
 * это позиция текущего листа, которой нет в эталоне.
 */
export function reconcilePositions(basket: BasketItem[], smeta: SmetaLite): Reconciliation {
  const fact = aggFact(smeta);
  const mine = aggMine(basket, smeta.sheet);
  const rows: PositionDiff[] = [];
  const counts: Record<DiffStatus, number> = { ok: 0, qty: 0, price: 0, missing: 0, extra: 0 };

  const codes = new Set<string>([...fact.keys(), ...mine.keys()]);
  for (const code of codes) {
    const f = fact.get(code);
    const my = mine.get(code);
    const base = {
      code,
      name: (f ?? my)!.name,
      unit: (f ?? my)!.unit,
      factQty: f ? f.qty : null,
      mineQty: my ? my.qty : null,
      factUnitPrice: f ? unitPriceOf(f) : null,
      mineUnitPrice: my ? unitPriceOf(my) : null,
      factSum: f ? f.sum : null,
      mineSum: my ? my.sum : null,
    };

    let status: DiffStatus;
    let note: string;
    if (f && !my) {
      status = "missing";
      note = "Позиция есть в эталонной ЛС, но не добавлена в вашу смету.";
    } else if (my && !f) {
      status = "extra";
      note = "Позиции нет в эталонной ЛС — лишняя или взята не из той сметы.";
    } else {
      const fp = unitPriceOf(f!);
      const mp = unitPriceOf(my!);
      if (!approxEqual(fp, mp)) {
        status = "price";
        note = "Расценка за единицу не совпала с эталоном — проверьте сборник/редакцию.";
      } else if (!approxEqual(f!.qty, my!.qty)) {
        status = "qty";
        const dir = my!.qty > f!.qty ? "завышен" : "занижен";
        note = `Объём ${dir}: эталон ${f!.qty}, у вас ${my!.qty} ${f!.unit}.`;
      } else {
        status = "ok";
        note = "Сошлось с эталоном.";
      }
    }
    counts[status] += 1;
    rows.push({ ...base, status, note });
  }

  // порядок: ошибки выше, затем по шифру
  const rank: Record<DiffStatus, number> = { price: 0, qty: 1, missing: 2, extra: 3, ok: 4 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || a.code.localeCompare(b.code));

  const matchedPct = fact.size > 0 ? (counts.ok / fact.size) * 100 : null;
  return { rows, counts, matchedPct };
}
