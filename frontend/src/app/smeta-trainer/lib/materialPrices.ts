/**
 * Подкладывание реальных цен ССЦ РК 8.04-08-2025 к материалам учебных расценок.
 *
 * Источники в порядке приоритета:
 *  1. User overrides (localStorage, ставит куратор/студент через UI)
 *  2. Auto-map из material-ssc-map.json (генерится Python-скриптом
 *     raw-corpus/match-seed-to-ssc.py)
 *
 * Покрытие auto-map ~64% (163/254). Overrides поднимают вручную.
 */

import map from "../data/material-ssc-map.json";

export type MaterialPriceSource = "ssc" | "edu";

export type MaterialMatch = {
  name: string;
  unit: string;
  sscCode: string;
  sscName: string;
  sscBook: string;
  score: number;
  smetnaya: number;
  otpusknaya: number | null;
  manual?: boolean;
};

export type MaterialUnmatched = {
  name: string;
  unit: string;
  reason?: string;
};

/** Override от пользователя — может быть привязка к ССЦ-коду или явный skip. */
export type MaterialOverride = {
  name: string;
  unit: string;
  sscCode: string | null;     // null = не нормируется ССЦ (manual skip)
  sscName?: string;           // подсказка для UI
  smetnaya?: number;
  otpusknaya?: number | null;
  sscBook?: string;
  setBy?: string | null;      // дата ISO (local) или userId (shared)
  setAt?: number;             // unix ms (для shared)
  source?: "local" | "shared"; // откуда — localStorage или backend (shared by curator)
};

const OVERRIDES_KEY = "aevion-smeta-overrides-v1";
const SHARED_CACHE_KEY = "aevion-smeta-overrides-shared-v1"; // снимок shared с backend

const matchedIndex = new Map<string, MaterialMatch>();
for (const m of map.materials as MaterialMatch[]) {
  matchedIndex.set(makeKey(m.name, m.unit), m);
}

const unmatchedIndex = new Set<string>();
for (const m of map.unmatched as MaterialUnmatched[]) {
  unmatchedIndex.add(makeKey(m.name, m.unit));
}

function makeKey(name: string, unit: string): string {
  return `${name.toLowerCase().trim()}|${unit.trim()}`;
}

// ── overrides storage ─────────────────────────────────────────────────────
// Слияние: shared (с backend, кеш в localStorage) ⊕ local (этот браузер).
// Local имеет приоритет если конфликт по ключу.

function loadShared(): Record<string, MaterialOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SHARED_CACHE_KEY);
    if (!raw) return {};
    const arr = JSON.parse(raw) as MaterialOverride[];
    const out: Record<string, MaterialOverride> = {};
    for (const o of arr) out[makeKey(o.name, o.unit)] = { ...o, source: "shared" };
    return out;
  } catch {
    return {};
  }
}

function loadLocal(): Record<string, MaterialOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, MaterialOverride>;
    const out: Record<string, MaterialOverride> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = { ...v, source: "local" };
    return out;
  } catch {
    return {};
  }
}

/** Запоминает снимок shared overrides (вызывается из mapping page при загрузке). */
export function cacheSharedOverrides(arr: MaterialOverride[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHARED_CACHE_KEY, JSON.stringify(arr));
  } catch {}
}

function loadOverrides(): Record<string, MaterialOverride> {
  return { ...loadShared(), ...loadLocal() }; // local перебивает shared
}

function saveLocalOverrides(o: Record<string, MaterialOverride>): void {
  if (typeof window === "undefined") return;
  try {
    // Сохраняем только local-записи, без shared-кеша
    const onlyLocal: Record<string, MaterialOverride> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v.source !== "shared") onlyLocal[k] = v;
    }
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(onlyLocal));
  } catch {}
}

export function getOverride(name: string, unit: string): MaterialOverride | null {
  return loadOverrides()[makeKey(name, unit)] ?? null;
}

export function setOverride(o: MaterialOverride): void {
  const local = loadLocal();
  local[makeKey(o.name, o.unit)] = {
    ...o,
    setBy: new Date().toISOString(),
    source: "local",
  };
  saveLocalOverrides(local);
}

export function clearOverride(name: string, unit: string): void {
  const local = loadLocal();
  delete local[makeKey(name, unit)];
  saveLocalOverrides(local);
}

export function listOverrides(): MaterialOverride[] {
  return Object.values(loadOverrides());
}

// ── lookups ───────────────────────────────────────────────────────────────

/** Найти ССЦ-привязку для материала (по имени + единице).
 *  Учитывает overrides поверх auto-map. */
export function findSscMatch(name: string, unit: string): MaterialMatch | null {
  const ov = getOverride(name, unit);
  if (ov) {
    if (ov.sscCode === null) return null; // explicit skip
    if (typeof ov.smetnaya === "number") {
      return {
        name, unit,
        sscCode: ov.sscCode,
        sscName: ov.sscName ?? "(override)",
        sscBook: ov.sscBook ?? "(override)",
        score: 1,
        smetnaya: ov.smetnaya,
        otpusknaya: ov.otpusknaya ?? null,
        manual: true,
      };
    }
    // Override без цены — fallback на auto если она там есть
  }
  return matchedIndex.get(makeKey(name, unit)) ?? null;
}

/** Получить эффективную цену + источник. */
export function resolveMaterialPrice(
  name: string,
  unit: string,
  educationPrice: number,
): { price: number; source: MaterialPriceSource; match?: MaterialMatch } {
  const m = findSscMatch(name, unit);
  if (m && m.smetnaya > 0) {
    return { price: m.smetnaya, source: "ssc", match: m };
  }
  return { price: educationPrice, source: "edu" };
}

export const materialMapMeta = {
  version: map.version,
  region: map.region,
  generatedAt: map.generated_at,
  matched: (map.materials as MaterialMatch[]).length,
  unmatched: (map.unmatched as MaterialUnmatched[]).length,
  total:
    (map.materials as MaterialMatch[]).length +
    (map.unmatched as MaterialUnmatched[]).length,
};

export function listMatched(): MaterialMatch[] {
  return map.materials as MaterialMatch[];
}

export function listUnmatched(): MaterialUnmatched[] {
  return map.unmatched as MaterialUnmatched[];
}

// ── ССЦ catalog autocomplete (для ResourceEditor) ────────────────────────
// Лениво подгружает приоритетные книги ССЦ, индексирует имена в плоский
// список. Используется для datalist/suggest при наборе имени материала.

type SscCatalogItem = {
  code: string;
  name: string;
  unit: string;
  smetnaya: number;
};

let catalog: SscCatalogItem[] | null = null;
let catalogLoading: Promise<SscCatalogItem[]> | null = null;

const CATALOG_BOOKS = [
  "ssc-2025-almaty-book1-v2",
  "ssc-2025-almaty-book7-v2",
  "ssc-2025-common-book2-v2",
  "ssc-2025-common-book3-v2",
  "ssc-2025-common-book6-v2",
];

export async function loadSscCatalog(): Promise<SscCatalogItem[]> {
  if (catalog) return catalog;
  if (catalogLoading) return catalogLoading;
  catalogLoading = (async () => {
    const out: SscCatalogItem[] = [];
    for (const slug of CATALOG_BOOKS) {
      try {
        const res = await fetch(`/ssc/${slug}.json`);
        if (!res.ok) continue;
        const data = (await res.json()) as { rows: Array<{ code: string; name: string; unit: string; smetnaya?: number; isGroup?: boolean }> };
        for (const r of data.rows) {
          if (r.isGroup) continue;
          if (r.smetnaya == null || r.smetnaya <= 0) continue;
          out.push({ code: r.code, name: r.name, unit: r.unit, smetnaya: r.smetnaya });
        }
      } catch { /* skip */ }
    }
    catalog = out;
    return out;
  })();
  return catalogLoading;
}

/** Поиск в каталоге ССЦ по имени (substring + опциональный фильтр по ед. изм.). */
export function searchSscCatalog(query: string, unit?: string, limit = 20): SscCatalogItem[] {
  if (!catalog) return [];
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: SscCatalogItem[] = [];
  const wantUnit = (unit ?? "").trim();
  const UNIT_EQ: Record<string, string> = { "м3": "м³", "м³": "м3", "м2": "м²", "м²": "м2", "шт": "шт.", "шт.": "шт" };
  function unitOk(u: string) {
    if (!wantUnit) return true;
    if (u === wantUnit) return true;
    return UNIT_EQ[u] === wantUnit || UNIT_EQ[wantUnit] === u;
  }
  for (const it of catalog) {
    if (!unitOk(it.unit)) continue;
    if (it.name.toLowerCase().includes(q)) {
      out.push(it);
      if (out.length >= limit) break;
    }
  }
  return out;
}
