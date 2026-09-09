/**
 * QSpace — минимальный разбор DXF (ASCII) в план стен.
 *
 * Понимает сущности LINE и LWPOLYLINE из секции ENTITIES — этого достаточно
 * для планировок, экспортированных из AutoCAD «как чертёж». Вставки блоков
 * (`INSERT`) разбираются ради ПРОЁМОВ: окна и двери в чертеже — это блоки,
 * а не отрезки. Дуги и штриховки НЕ разбираются (честно в warnings).
 *
 * Единицы: сперва читается $INSUNITS из HEADER; если её нет — эвристика по
 * габариту (>1000 → мм, >100 → см, иначе метры). Выбранная единица
 * возвращается наружу и показывается человеку: молча угадывать масштаб
 * нельзя, ошибка масштаба — это тихая неверная модель.
 */

import type { Plan, Wall } from "./planModel";
import { WALL_HEIGHT } from "./planModel";
import { nearestWall, placeOpening } from "./openings";

export interface DxfResult {
  plan: Plan | null;
  warnings: string[];
  /** во что была пересчитана координата: подпись для человека */
  unitLabel: string;
  /** сколько отрезков отброшено обрезкой (0 = ничего) */
  truncated: number;
}

interface Seg { x1: number; y1: number; x2: number; y2: number; layer: string }

/** Вставка блока: точка и имя. Из неё выводятся окна и двери. */
interface Block { x: number; y: number; name: string; layer: string }

const MAX_SEGMENTS = 400;

/**
 * Как распознаётся дверь и окно среди блоков чертежа.
 *
 * В AutoCAD проём — это ВСТАВКА БЛОКА (`INSERT`), а не отрезок: у неё есть
 * точка и имя, но нет ни ширины, ни привязки к стене. Поэтому:
 *
 *  - вид (дверь или окно) берётся из ИМЕНИ блока и слоя — других сведений в
 *    файле нет; чертёжники называют их по-разному, и незнакомые имена мы
 *    честно считаем и НЕ угадываем;
 *  - ШИРИНА берётся из типового размера, а не из чертежа. Масштаб блока
 *    (коды 41/42) описывает растяжение символа, а не проёма, и выводить из
 *    него ширину значило бы получить правдоподобно неверное число;
 *  - точка вставки привязывается к БЛИЖАЙШЕЙ стене; если стены рядом нет,
 *    проём не ставится и попадает в счёт непривязанных.
 *
 * Всё это говорится человеку на странице: он видит, сколько блоков найдено,
 * сколько распознано и почему остальные нет.
 */
const DOOR_RE = /(дверь|двер|door|dr[-_]|d[-_]?\d)/i;
const WINDOW_RE = /(окно|окн|window|win[-_]|w[-_]?\d)/i;

/**
 * Вид проёма по блоку: сперва по ИМЕНИ, и только потом по слою.
 *
 * ⚠️ Порядок не косметика. Первая версия склеивала имя со слоем в одну строку
 * и спрашивала «есть ли где-нибудь слово door» — окно с именем «ОКНО-1400»,
 * лежащее на слое `A-DOOR` (в реальных чертежах проёмы часто на одном слое),
 * становилось ДВЕРЬЮ. Имя конкретнее слоя: слой описывает группу, имя —
 * предмет. Поймал тест, где имя и слой спорят.
 */
function kindOfBlock(
  name: string,
  layer: string,
): { kind: "door" | "window"; byLayer: boolean } | null {
  if (WINDOW_RE.test(name)) return { kind: "window", byLayer: false };
  if (DOOR_RE.test(name)) return { kind: "door", byLayer: false };
  // ⚠️ Слой — ДОГАДКА, и она бывает неверной: шкаф-купе, попавший на слой
  // дверей, стал бы дверью в стене. Отказаться от неё нельзя (блоки часто
  // зовут «BLK17»), поэтому такие проёмы считаются ОТДЕЛЬНО и человеку
  // говорится, сколько их и почему: молча угадывать нельзя, а подсказку
  // выбрасывать жалко.
  if (WINDOW_RE.test(layer)) return { kind: "window", byLayer: true };
  if (DOOR_RE.test(layer)) return { kind: "door", byLayer: true };
  return null;
}

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
  const blocks: Block[] = [];
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

    if (inEntities && code === 0 && val === "INSERT") {
      let name = "", layer = "", x = NaN, y = NaN;
      let j = i + 1;
      for (; j < ps.length && ps[j][0] !== 0; j++) {
        const [c, v] = ps[j];
        if (c === 2) name = v;
        else if (c === 8) layer = v;
        else if (c === 10) x = parseFloat(v);
        else if (c === 20) y = parseFloat(v);
      }
      if (Number.isFinite(x) && Number.isFinite(y)) blocks.push({ x, y, name, layer });
      i = j;
      continue;
    }

    if (inEntities && code === 0 && val !== "ENDSEC" && val !== "SECTION") {
      if (["ARC", "CIRCLE", "SPLINE", "HATCH", "ELLIPSE"].includes(val)) skipped.add(val);
    }
    i++;
  }

  if (skipped.size > 0) {
    // Список пропущенного берётся из ТОГО ЖЕ набора, что и проверка выше:
    // фраза «блоки не разбираются» пережила бы правку, которая их разбирать
    // научила, и сутки говорила бы человеку неправду о его же чертеже.
    warnings.push(
      `Пропущены сущности: ${[...skipped].sort().join(", ")} — стены строятся из`
      + " LINE и LWPOLYLINE, проёмы из блоков INSERT, остальное не разбирается.",
    );
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

  // ⚠️ `placeOpening` НЕ меняет план на месте, а возвращает новый: страница
  // работает через состояние React, где менять объект нельзя. Первая версия
  // этого разбора звала его как изменяющий — счётчик честно печатал
  // «распознано 1», а в плане был ноль проёмов. Поймал тест, чтением не видно.
  let plan: Plan = { name: "Импорт DXF", walls, openings: [], source: "dxf" };

  // --- проёмы из блоков ---------------------------------------------------
  // Ставятся ТЕМИ ЖЕ функциями, что и клик человека по стене: они уже умеют
  // отказать, если проём не влезает или налезает на соседний. Второй способ
  // ставить проёмы стал бы вторым источником правды.
  let recognised = 0;
  let unattached = 0;
  let byLayer = 0;
  let rejected = 0;
  const rejectReasons = new Set<string>();
  const unknownNames = new Set<string>();
  for (const b of blocks) {
    const guess = kindOfBlock(b.name, b.layer);
    if (!guess) { unknownNames.add(b.name || "(без имени)"); continue; }
    const hit = nearestWall(plan, (b.x - minX) * scale, (b.y - minY) * scale, 0.7);
    // ⚠️ Два РАЗНЫХ отказа, и человеку нужны разные слова. «Стены рядом нет» —
    // скорее всего блок не на плане (штамп, условное обозначение). «Не влез» —
    // стена найдена, но проём в неё не помещается или налезает на соседний, и
    // это уже про сам чертёж. Считать их одним числом значило бы сказать про
    // половину случаев неправду.
    if (!hit) { unattached++; continue; }
    const res = placeOpening(plan, hit, guess.kind);
    if (res.ok) {
      plan = res.plan;
      recognised++;
      if (guess.byLayer) byLayer++;
    } else {
      rejected++;
      if (rejectReasons.size < 3) rejectReasons.add(res.reason);
    }
  }
  if (blocks.length > 0) {
    warnings.push(
      `Блоков в чертеже: ${blocks.length}. Проёмов распознано: ${recognised}`
      + (unattached > 0 ? `, рядом нет стены: ${unattached}` : "")
      + (rejected > 0
        ? `, не помещается в стену: ${rejected} (${[...rejectReasons].join("; ")})`
        : "")
      + (byLayer > 0
        ? `, из них по СЛОЮ (имя блока молчит): ${byLayer} — проверьте, не мебель ли это`
        : "")
      + (unknownNames.size > 0
        ? `, имена не опознаны: ${[...unknownNames].slice(0, 5).join(", ")}`
          + (unknownNames.size > 5 ? ` и ещё ${unknownNames.size - 5}` : "")
        : "")
      + ". Ширина проёма взята ТИПОВАЯ, а не из чертежа: масштаб блока описывает"
      + " растяжение символа, а не размер проёма. Проверьте и поправьте кликом.",
    );
  }

  return { plan, warnings, unitLabel, truncated };
}
