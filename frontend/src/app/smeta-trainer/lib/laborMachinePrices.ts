/**
 * Подкладывание реальных ставок труда (СЦЗТ-2025) и машин (СЦЭМ-2025) к
 * ресурсам учебных расценок. По аналогии с materialPrices.ts.
 *
 * Используется в lib/calc.ts при включённом useSscPrices = true:
 *  - Для ресурса kind="труд" → findLaborRate(имя ресурса) → СЦЗТ для разряда
 *  - Для ресурса kind="машины" → findMachineRate(имя ресурса) → сметная ставка
 *
 * ⚠ Файлы СЦЗТ + СЦЭМ ~1.3 МБ. Грузим лениво при первом вызове.
 */

type LaborRate = {
  regionCode: string;
  groupCode: string;
  rank: number;
  sczt: number;
  sts: number;
};
type LaborFile = {
  version: string;
  rates: LaborRate[];
};

type MachineRow = {
  code: string;
  name: string;
  isGroup?: boolean;
  smetnaya?: number;
};
type MachineFile = {
  version: string;
  region: string;
  rows: MachineRow[];
};

// ── Synchronous lazy load via fetch + module-level cache ───────────────
// В прод-сборке init() будет вызван при первом рендере страницы /smeta-trainer
// (см. вызов из LsrEditor useEffect ниже).

// Лента: regionCode → groupCode → rank → rate
let laborByRegionGroupRank: Map<string, Map<string, Map<number, LaborRate>>> | null = null;
let machinesByName: Map<string, MachineRow> | null = null;
let initStarted = false;
let initPromise: Promise<void> | null = null;

const REGION_ALMATY = "02";
const GROUP_FALLBACK = "003"; // отделочные — fallback если category не сматчена

/** Маппинг категории работ из seed.json → группа СЦЗТ.
 *  Группы СЦЗТ:
 *   001 — Земляные работы и устройство земляных конструкций
 *   002 — Несущие и ограждающие конструкции
 *   003 — Отделочные и изоляционные
 *   004 — Внутренние и наружные инженерные системы
 *   005 — Специальные строительные и монтажные
 *   006 — Спецработы в грунтах, конструкций
 *   007 — Монтаж оборудования
 *   009 — Ремонт зданий и сооружений
 */
export const CATEGORY_TO_LABOR_GROUP: Record<string, string> = {
  "общестроительные": "002",
  "ремонтно-строительные": "009",
  "монтаж-оборудования": "007",
  "электромонтажные": "005",
  "сантехнические": "004",
  "отделочные": "003",
  "земляные": "001",
  "кровельные": "002",
  "демонтажные": "009",
};

async function init(): Promise<void> {
  if (initStarted) return initPromise!;
  initStarted = true;
  initPromise = (async () => {
    // Труд: индексируем все регионы + группы (полный СЦЗТ)
    try {
      const res = await fetch("/normatives/sczt-2025.json");
      if (res.ok) {
        const data = (await res.json()) as LaborFile;
        const root = new Map<string, Map<string, Map<number, LaborRate>>>();
        for (const r of data.rates) {
          let regMap = root.get(r.regionCode);
          if (!regMap) { regMap = new Map(); root.set(r.regionCode, regMap); }
          let grpMap = regMap.get(r.groupCode);
          if (!grpMap) { grpMap = new Map(); regMap.set(r.groupCode, grpMap); }
          grpMap.set(Math.round(r.rank * 10) / 10, r);
        }
        laborByRegionGroupRank = root;
      }
    } catch { /* offline */ }
    // Машины
    try {
      const res = await fetch("/normatives/szem-2025-almaty.json");
      if (res.ok) {
        const data = (await res.json()) as MachineFile;
        const m = new Map<string, MachineRow>();
        for (const row of data.rows) {
          if (row.isGroup) continue;
          if (row.smetnaya == null) continue;
          // Канонизация имени для поиска
          m.set(canonName(row.name), row);
        }
        machinesByName = m;
      }
    } catch {}
  })();
  return initPromise;
}
// Запускаем init в фоне сразу при импорте модуля (только в браузере)
if (typeof window !== "undefined") init();

function canonName(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё0-9 ]+/giu, " ").replace(/\s+/g, " ").trim();
}

// ── Извлечение разряда из имени ресурса ──────────────────────────────
// Примеры: "Подсобный рабочий 2 разряда" → 2.0
//          "Штукатур 4 разряда" → 4.0
//          "Плотник 3,5 разряда" → 3.5
const RANK_RE = /(\d+(?:[.,]\d+)?)\s*разряд/i;
export function extractRank(name: string): number | null {
  const m = RANK_RE.exec(name);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

/** Найти ставку СЦЗТ для рабочего по имени и (опционально) категории работ.
 *  category — из seed.json (например, "отделочные") → группа СЦЗТ через
 *  CATEGORY_TO_LABOR_GROUP. Если category не задана или не сматчена —
 *  fallback на 003 (отделочные). region — slug ("almaty" по умолчанию). */
export function findLaborRate(
  name: string,
  category?: string,
  regionCode: string = REGION_ALMATY,
): { sczt: number; sts: number; rank: number; groupCode: string } | null {
  if (!laborByRegionGroupRank) return null;
  const rank = extractRank(name);
  if (rank == null) return null;
  const key = Math.round(rank * 10) / 10;
  const groupCode = (category && CATEGORY_TO_LABOR_GROUP[category]) || GROUP_FALLBACK;
  const regMap = laborByRegionGroupRank.get(regionCode) ?? laborByRegionGroupRank.get(REGION_ALMATY);
  if (!regMap) return null;
  // Пробуем выбранную группу, потом fallback
  let rec = regMap.get(groupCode)?.get(key);
  if (!rec) rec = regMap.get(GROUP_FALLBACK)?.get(key);
  if (!rec) return null;
  return { sczt: rec.sczt, sts: rec.sts, rank: rec.rank, groupCode: rec.groupCode };
}

// ── Поиск машины по имени ресурса (fuzzy) ────────────────────────────
// Имена в seed.json типа «Перфоратор электрический», «Растворонасос».
// СЦЭМ имена развёрнутые: «Перфораторы электрические среднего типа».
// Берём 2-3 первых значимых токена.
export function findMachineRate(name: string): { smetnaya: number; sscName: string; sscCode: string } | null {
  if (!machinesByName) return null;
  const tokens = canonName(name).split(" ").filter((t) => t.length > 3).slice(0, 2);
  if (tokens.length === 0) return null;
  // 1) Точное совпадение по первому токену + второй
  let best: MachineRow | null = null;
  let bestScore = 0;
  for (const [k, row] of machinesByName.entries()) {
    let score = 0;
    for (const t of tokens) {
      if (k.includes(t)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  if (!best || bestScore === 0) return null;
  return { smetnaya: best.smetnaya!, sscName: best.name, sscCode: best.code };
}

export const laborMachineMeta = () => ({
  laborLoaded: laborByRegionGroupRank !== null,
  machinesLoaded: machinesByName !== null,
  laborRegions: laborByRegionGroupRank?.size ?? 0,
  machineCount: machinesByName?.size ?? 0,
});

export { init as initLaborMachinePrices };
