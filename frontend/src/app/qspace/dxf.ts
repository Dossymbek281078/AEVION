/**
 * QSpace — минимальный разбор DXF (ASCII) в план стен.
 *
 * Понимает сущности LINE и LWPOLYLINE из секции ENTITIES — этого достаточно
 * для планировок, экспортированных из AutoCAD «как чертёж». Дуги, блоки и
 * штриховки НЕ разбираются (честно сообщается в warnings).
 *
 * Единицы: сперва читается $INSUNITS из HEADER; если её нет — эвристика по
 * габариту (>1000 → мм, >100 → см, иначе метры). Выбранная единица
 * возвращается наружу и показывается человеку: молча угадывать масштаб
 * нельзя, ошибка масштаба — это тихая неверная модель.
 */

import type { Plan, Wall } from "./planModel";
import { WALL_HEIGHT } from "./planModel";

export interface DxfResult {
  plan: Plan | null;
  warnings: string[];
  /** во что была пересчитана координата: подпись для человека */
  unitLabel: string;
  /** сколько отрезков отброшено обрезкой (0 = ничего) */
  truncated: number;
}

interface Seg { x1: number; y1: number; x2: number; y2: number; layer: string }

const MAX_SEGMENTS = 400;

/** Разбор пар «код группы / значение». */
function pairs(text: string): Array<[number, string]> {
  const lines = text.split(/\r?\n/);
  const out: Array<[number, string]> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    out.push([code, lines[i + 1].trim()]);
  }
  return out;
}

export function parseDxf(text: string): DxfResult {
  const warnings: string[] = [];
  if (!text || text.indexOf("ENTITIES") < 0) {
    return {
      plan: null,
      warnings: ["В файле не найдена секция ENTITIES — это не ASCII-DXF. Бинарный DWG сохраните из AutoCAD как DXF (ASCII)."],
      unitLabel: "—",
      truncated: 0,
    };
  }

  const ps = pairs(text);

  // --- $INSUNITS из заголовка -------------------------------------------
  let insUnits: number | null = null;
  for (let i = 0; i < ps.length - 1; i++) {
    if (ps[i][0] === 9 && ps[i][1] === "$INSUNITS") {
      for (let j = i + 1; j < Math.min(i + 4, ps.length); j++) {
        if (ps[j][0] === 70) { insUnits = parseInt(ps[j][1], 10); break; }
      }
      break;
    }
  }

  // --- сущности ----------------------------------------------------------
  const segs: Seg[] = [];
  const skipped = new Set<string>();
  let i = 0;
  // границы секции ENTITIES
  let inEntities = false;
  while (i < ps.length) {
    const [code, val] = ps[i];
    if (code === 2 && val === "ENTITIES") inEntities = true;
    if (code === 0 && val === "ENDSEC") inEntities = false;

    if (inEntities && code === 0 && val === "LINE") {
      let x1 = NaN, y1 = NaN, x2 = NaN, y2 = NaN, layer = "";
      let j = i + 1;
      for (; j < ps.length && ps[j][0] !== 0; j++) {
        const [c, v] = ps[j];
        if (c === 8) layer = v;
        else if (c === 10) x1 = parseFloat(v);
        else if (c === 20) y1 = parseFloat(v);
        else if (c === 11) x2 = parseFloat(v);
        else if (c === 21) y2 = parseFloat(v);
      }
      if ([x1, y1, x2, y2].every(Number.isFinite)) segs.push({ x1, y1, x2, y2, layer });
      i = j;
      continue;
    }

    if (inEntities && code === 0 && val === "LWPOLYLINE") {
      let layer = "";
      let closed = false;
      const xs: number[] = [];
      const ys: number[] = [];
      let j = i + 1;
      for (; j < ps.length && ps[j][0] !== 0; j++) {
        const [c, v] = ps[j];
        if (c === 8) layer = v;
        else if (c === 70) closed = (parseInt(v, 10) & 1) === 1;
        else if (c === 10) xs.push(parseFloat(v));
        else if (c === 20) ys.push(parseFloat(v));
      }
      const n = Math.min(xs.length, ys.length);
      for (let k = 0; k + 1 < n; k++) {
        segs.push({ x1: xs[k], y1: ys[k], x2: xs[k + 1], y2: ys[k + 1], layer });
      }
      if (closed && n >= 3) {
        segs.push({ x1: xs[n - 1], y1: ys[n - 1], x2: xs[0], y2: ys[0], layer });
      }
      i = j;
      continue;
    }

    if (inEntities && code === 0 && val !== "ENDSEC" && val !== "SECTION") {
      if (["ARC", "CIRCLE", "SPLINE", "INSERT", "HATCH", "ELLIPSE"].includes(val)) skipped.add(val);
    }
    i++;
  }

  if (skipped.size > 0) {
    warnings.push(`Пропущены сущности: ${[...skipped].sort().join(", ")} — разбираются только LINE и LWPOLYLINE (дуги и блоки — этап 2).`);
  }
  if (segs.length === 0) {
    return { plan: null, warnings: [...warnings, "Не найдено ни одного отрезка LINE/LWPOLYLINE."], unitLabel: "—", truncated: 0 };
  }

  // --- фильтр по слоям стен ---------------------------------------------
  const wallRe = /(wall|стен|перегород|w-|a-wall)/i;
  const wallSegs = segs.filter((s) => wallRe.test(s.layer));
  let used = segs;
  if (wallSegs.length >= 4) {
    used = wallSegs;
    warnings.push(`Взят слой стен (${wallSegs.length} отрезков из ${segs.length}); остальные слои чертежа не строились.`);
  } else {
    warnings.push(`Слой со словом «wall/стена» не найден — взяты ВСЕ ${segs.length} отрезков. Размерные линии могли стать «стенами»: проверьте глазами.`);
  }

  // --- масштаб ------------------------------------------------------------
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of used) {
    minX = Math.min(minX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2); maxY = Math.max(maxY, s.y1, s.y2);
  }
  const extent = Math.max(maxX - minX, maxY - minY);
  let scale = 1;
  let unitLabel = "м (как в файле)";
  if (insUnits === 4) { scale = 1 / 1000; unitLabel = "мм ($INSUNITS)"; }
  else if (insUnits === 5) { scale = 1 / 100; unitLabel = "см ($INSUNITS)"; }
  else if (insUnits === 6) { scale = 1; unitLabel = "м ($INSUNITS)"; }
  else if (insUnits === 1) { scale = 0.0254; unitLabel = "дюймы ($INSUNITS)"; }
  else if (extent > 1000) { scale = 1 / 1000; unitLabel = "мм (по габариту)"; }
  else if (extent > 100) { scale = 1 / 100; unitLabel = "см (по габариту)"; }

  // --- сборка плана -------------------------------------------------------
  let truncated = 0;
  let list = used;
  if (list.length > MAX_SEGMENTS) {
    // оставляем самые длинные: короткое — чаще всего штриховка и надписи
    list = [...list].sort(
      (a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1),
    ).slice(0, MAX_SEGMENTS);
    truncated = used.length - MAX_SEGMENTS;
    warnings.push(`Отрезков больше ${MAX_SEGMENTS}: показаны ${MAX_SEGMENTS} самых длинных, отброшено ${truncated}.`);
  }

  const walls: Wall[] = [];
  for (const s of list) {
    const w: Wall = {
      x1: (s.x1 - minX) * scale,
      y1: (s.y1 - minY) * scale,
      x2: (s.x2 - minX) * scale,
      y2: (s.y2 - minY) * scale,
      thickness: 0.15,
      height: WALL_HEIGHT,
    };
    if (Math.hypot(w.x2 - w.x1, w.y2 - w.y1) < 0.05) continue; // мусор < 5 см
    walls.push(w);
  }
  if (walls.length === 0) {
    return { plan: null, warnings: [...warnings, "После пересчёта масштаба стен не осталось (все отрезки короче 5 см)."], unitLabel, truncated };
  }

  return {
    plan: { name: "Импорт DXF", walls, openings: [], source: "dxf" },
    warnings,
    unitLabel,
    truncated,
  };
}
