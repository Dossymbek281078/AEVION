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

let laborByRank: Map<number, LaborRate> | null = null;
let machinesByName: Map<string, MachineRow> | null = null;
let initStarted = false;
let initPromise: Promise<void> | null = null;

const REGION_ALMATY = "02";
const GROUP_FALLBACK = "003"; // отделочные — самая частая группа в учебном корпусе

async function init(): Promise<void> {
  if (initStarted) return initPromise!;
  initStarted = true;
  initPromise = (async () => {
    // Truд
    try {
      const res = await fetch("/normatives/sczt-2025.json");
      if (res.ok) {
        const data = (await res.json()) as LaborFile;
        const m = new Map<number, LaborRate>();
        // По группе FALLBACK + Алматы — у нас только один разряд на rank
        for (const r of data.rates) {
          if (r.regionCode !== REGION_ALMATY) continue;
          if (r.groupCode !== GROUP_FALLBACK) continue;
          m.set(r.rank, r);
        }
        laborByRank = m;
      }
    } catch { /* offline — оставим null, будет fallback на учебные цены */ }
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

/** Найти ставку СЦЗТ для рабочего по имени. */
export function findLaborRate(name: string): { sczt: number; sts: number; rank: number; groupCode: string } | null {
  if (!laborByRank) return null;
  const rank = extractRank(name);
  if (rank == null) return null;
  // СЦЗТ имеет шаг 0.1 (1.0, 1.1, ..., 8.0). Округляем до ближайшего.
  const key = Math.round(rank * 10) / 10;
  const rec = laborByRank.get(key);
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
  laborLoaded: laborByRank !== null,
  machinesLoaded: machinesByName !== null,
  laborCount: laborByRank?.size ?? 0,
  machineCount: machinesByName?.size ?? 0,
});

export { init as initLaborMachinePrices };
