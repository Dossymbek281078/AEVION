import type { RasterSegment } from "./raster";

/**
 * QSpace — стены на растровом плане ПО ТОЛЩИНЕ ШТРИХА (JPEG, PNG, фото, скан).
 *
 * Перенос в браузер прототипа `инструмент-план-в-3D/raster_walls.py`, который
 * на PNG LA VIE дал 13 комнат / 163 м² (вектор — 11 / 159). Без нейросети и
 * внешних библиотек. Что решило дело и в каком порядке:
 *
 *   1. чернила — не по одному порогу: фон (закрытие большим окном) выравнивает
 *      тени фото и серую бумагу, картинка делится на фон, порог Оцу уже по ней.
 *      Адаптивный порог не годится: внутри толстой стены он видит «фон».
 *   2. кляксы (фото, штампы, заливки) — по форме, ДО оценки толщины: компонента,
 *      заполняющая свой прямоугольник больше чем на 40 % при меньшей стороне
 *      от 40 px, стеной быть не может.
 *   3. толщина штриха — 2 × расстояние до фона на гребне. Стены — самые толстые
 *      ЛИНЕЙНЫЕ штрихи; текст, размеры и мебель — 1–3 px. Толщина стены — 95-й
 *      процентиль, порог — четверть от неё (перегородки тоньше наружных), но не
 *      тоньше 4 px.
 *   4. план — самая крупная группа толстых штрихов плюс все группы от 10 % её
 *      размера (дверные разрывы делят план надвое); заголовок и штамп — вне.
 *   5. стены по осям — прямоугольники из построчных прогонов маски (ось по
 *      длинной стороне, толщина по короткой); стены под углом (LA VIE: V-образное
 *      крыло) — преобразование Хафа по гребню остатка маски. Концы продлены на
 *      0.6 толщины: обрыв на стыке — щель, через которую комната «утекает».
 *   6. окна и витражи — тонкие чернила в створе между двумя коллинеарными
 *      стенами: стеклянный отрезок замыкает контур для площадей.
 *
 *   5б. полые стены — две параллельные тонкие линии на расстоянии стены (контур
 *      со штриховкой без заливки): Хаф по тонким чернилам внутри прямоугольника
 *      плана, пара с перекрытием по длине → стена посередине.
 *
 * 🔴 Границы, замер 15.09 на PNG LA VIE 2000×1125: стена 22 px, ~140 отрезков,
 * косое крыло и полые стены найдены, но комнат 3 (вектор — 11): контур течёт через
 * ОКНА КОСЫХ стен (стекло ищется только по осям) и широкие проёмы; прежний способ
 * по прогонам на той же картинке — 1 комната. Лист должен быть без наклона
 * (выпрямка по контуру листа — следующий шаг); толщина стены ≥ 4 px (иначе —
 * запасной путь по прогонам, `raster.ts`); масштаб называет человек; результат
 * всегда проходит экран проверки — лишнее (мебель, штриховка) снимается кликом.
 */

/** Отрезок стены: h/v — по осям (из прямоугольников), d — под углом (по Хафу). */
export interface WallSeg extends Omit<RasterSegment, "axis"> { axis: "h" | "v" | "d"; glass?: boolean }

export interface RasterWallsResult {
  segments: WallSeg[];
  warnings: string[];
  /** толщина наружной стены, px (95-й процентиль линейных штрихов) */
  wallPx: number;
  /** порог толщины, от которого штрих считается стеной, px */
  minPx: number;
  inkFraction: number;
  /** счётчики по шагам — для разбора, почему нашлось столько */
  stats?: Record<string, number>;
  /** маски чернил и стен — только при debug, для разбора глазами */
  masks?: { ink: Uint8Array; walls: Uint8Array };
}

/** Скользящий максимум/минимум по строкам и столбцам (окно 2r+1), O(n). */
function extrema(src: Uint8Array, w: number, h: number, r: number, max: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  const line = (get: (i: number) => number, set: (i: number, v: number) => void, n: number) => {
    const dq = new Int32Array(n); let head = 0, tail = 0;
    for (let i = 0; i < n + r; i++) {
      if (i < n) {
        const v = get(i);
        while (tail > head && (max ? get(dq[tail - 1]) <= v : get(dq[tail - 1]) >= v)) tail--;
        dq[tail++] = i;
      }
      const o = i - r;
      if (o >= 0) { while (dq[head] < o - r) head++; set(o, get(dq[head])); }
    }
  };
  for (let y = 0; y < h; y++) line((i) => src[y * w + i], (i, v) => { tmp[y * w + i] = v; }, w);
  for (let x = 0; x < w; x++) line((i) => tmp[i * w + x], (i, v) => { out[i * w + x] = v; }, h);
  return out;
}

function otsu(v: Uint8Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < v.length; i++) hist[v[i]]++;
  const total = v.length;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, bestT = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (wB === 0) continue;
    const wF = total - wB; if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; bestT = t; }
  }
  return bestT;
}

/** Расстояние до фона (шамфер 3-4, в третях пикселя) для маски mask[i] != 0. */
function distance(mask: Uint8Array, w: number, h: number): Int32Array {
  const INF = 1 << 28;
  const d = new Int32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) { v = Math.min(v, d[i - w] + 3); if (x > 0) v = Math.min(v, d[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 3); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4); if (x > 0) v = Math.min(v, d[i + w - 1] + 4); }
    d[i] = v;
  }
  return d;
}

interface Comp { count: number; x0: number; y0: number; x1: number; y1: number }

/** Связные компоненты (4-соседство); labels[i] = номер (1..), 0 — фон. */
function components(mask: Uint8Array, w: number, h: number): { labels: Int32Array; comps: Comp[] } {
  const labels = new Int32Array(w * h);
  const comps: Comp[] = [];
  const stack = new Int32Array(w * h);
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || labels[s]) continue;
    const id = comps.length + 1;
    const c: Comp = { count: 0, x0: w, y0: h, x1: 0, y1: 0 };
    let top = 0; stack[top++] = s; labels[s] = id;
    while (top > 0) {
      const i = stack[--top]; const x = i % w, y = (i - x) / w;
      c.count++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      const nb = [i - 1, i + 1, i - w, i + w];
      if (x === 0) nb[0] = -1; if (x === w - 1) nb[1] = -1;
      for (const j of nb) if (j >= 0 && j < mask.length && mask[j] && !labels[j]) { labels[j] = id; stack[top++] = j; }
    }
    comps.push(c);
  }
  return { labels, comps };
}

function percentile(a: number[], p: number): number {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
}

/**
 * Отрезки под любым углом из точек гребня — преобразование Хафа по углам с
 * шагом 1°: для каждого угла гистограмма по ρ (окно из пяти соседних ρ — при
 * 2000 px шаг в 1° разводит голоса одной прямой на ±3 px), пики от minLen
 * голосов → точки в 3 px от прямой → разрезка по разрывам больше gapPx →
 * отрезки от minLen длиной. Сплошная линия даёт точку почти на каждый пиксель
 * длины (косая — ~0.7), буквы и штриховка вдоль одной прямой — редкие точки:
 * плотность ниже половины не берём. Дубли одной прямой с соседних углов
 * снимаются: остаётся самый длинный.
 */
function houghSegments(pts: Array<[number, number, number]>, wallPx: number, ext: number, minLen = 2 * wallPx, gapPx = 1.5 * wallPx, axis: WallSeg["axis"] = "d", dupPx = wallPx): WallSeg[] {
  const out: WallSeg[] = [];
  if (pts.length < minLen) return out;
  const NT = 180;
  const maxR = Math.ceil(Math.hypot(Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])))) + 1;
  const W = 2 * maxR + 1;
  const hist = new Int32Array(W), sm = new Int32Array(W);
  const proj = new Float64Array(pts.length);
  for (let t = 0; t < NT; t++) {
    const cos = Math.cos((t * Math.PI) / NT), sin = Math.sin((t * Math.PI) / NT);
    hist.fill(0);
    for (let k = 0; k < pts.length; k++) { proj[k] = pts[k][0] * cos + pts[k][1] * sin; hist[Math.round(proj[k]) + maxR]++; }
    for (let i = 0; i < W; i++) sm[i] = hist[i] + (i > 0 ? hist[i - 1] : 0) + (i > 1 ? hist[i - 2] : 0) + (i + 1 < W ? hist[i + 1] : 0) + (i + 2 < W ? hist[i + 2] : 0);
    for (let i = 2; i < W - 2; i++) {
      const v = sm[i];
      if (v < minLen) continue;
      let peak = true;
      for (let o = -4; o <= 4 && peak; o++) if (o !== 0 && i + o >= 0 && i + o < W && (sm[i + o] > v || (sm[i + o] === v && o < 0))) peak = false;
      if (!peak) continue;
      const rho = i - maxR;
      const along: Array<[number, number, number]> = [];
      for (let k = 0; k < pts.length; k++) if (Math.abs(proj[k] - rho) <= 3) along.push([-pts[k][0] * sin + pts[k][1] * cos, k, pts[k][2]]);
      along.sort((x, y) => x[0] - y[0]);
      let run: typeof along = [];
      const flush = () => {
        const extent = run.length >= 2 ? run[run.length - 1][0] - run[0][0] : 0;
        if (run.length >= 2 && extent >= minLen && run.length >= 0.5 * extent) {
          const a = run[0][0] - ext, b = run[run.length - 1][0] + ext;
          const weights = run.map((q) => q[2]).sort((x, y) => x - y);
          // точка на прямой: (rho·cos, rho·sin) + s·(−sin, cos)
          out.push({ x1: rho * cos - a * sin, y1: rho * sin + a * cos, x2: rho * cos - b * sin, y2: rho * sin + b * cos, weight: weights[Math.floor(weights.length / 2)], axis });
        }
        run = [];
      };
      for (const q of along) { if (run.length && q[0] - run[run.length - 1][0] > gapPx) flush(); run.push(q); }
      flush();
    }
  }
  // дубли: та же прямая с соседнего угла — короче и лежит на длинном
  const len = (q: WallSeg) => Math.hypot(q.x2 - q.x1, q.y2 - q.y1);
  out.sort((x, y) => len(y) - len(x));
  const kept: WallSeg[] = [];
  for (const q of out) {
    const lq = len(q); const ux = (q.x2 - q.x1) / lq, uy = (q.y2 - q.y1) / lq;
    const dup = kept.some((k) => {
      const lk = len(k); const vx = (k.x2 - k.x1) / lk, vy = (k.y2 - k.y1) / lk;
      if (Math.abs(ux * vx + uy * vy) < Math.cos((3 * Math.PI) / 180)) return false;
      // та же прямая с соседнего угла отклоняется на концах на градус длины — сравниваем СЕРЕДИНУ
      const mx = (q.x1 + q.x2) / 2, my = (q.y1 + q.y2) / 2;
      if (Math.abs(-vy * (mx - k.x1) + vx * (my - k.y1)) > dupPx) return false;
      const p1 = vx * (q.x1 - k.x1) + vy * (q.y1 - k.y1), p2 = vx * (q.x2 - k.x1) + vy * (q.y2 - k.y1);
      const lo = Math.max(0, Math.min(p1, p2)), hi = Math.min(lk, Math.max(p1, p2));
      return hi - lo >= 0.6 * lq;
    });
    if (!dup) kept.push(q);
  }
  return kept;
}

export function findWallsByThickness(rgba: Uint8ClampedArray, w: number, h: number, debug = false): RasterWallsResult {
  const warnings: string[] = [];
  const n = w * h;
  const lum = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = rgba[i * 4 + 3] / 255;
    // прозрачное — белое, не чернила
    lum[i] = Math.round((0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) * a + 255 * (1 - a));
  }
  // 1. фон и чернила
  const r = Math.max(8, Math.round(Math.max(w, h) / 50));
  const bg = extrema(extrema(lum, w, h, r, true), w, h, r, false);
  const norm = new Uint8Array(n);
  for (let i = 0; i < n; i++) norm[i] = Math.min(255, Math.round((lum[i] * 255) / Math.max(1, bg[i])));
  // Оцу делит чёрное и белое, но толстые стены часто залиты СЕРЫМ (LA VIE: наружные
  // стены ~140 из 255 при чёрных перегородках) — порог не ниже 170: фон после
  // деления — 255 с шумом ±20, серые заливки — чернила
  const T = Math.min(200, Math.max(otsu(norm), 170));
  const ink = new Uint8Array(n);
  let inkCount = 0;
  // порог Оцу делит «≤ T» и «> T»: чисто чёрные чернила на белом дают T = 0
  for (let i = 0; i < n; i++) if (norm[i] <= T) { ink[i] = 1; inkCount++; }
  const inkFraction = inkCount / n;
  const empty = { segments: [], warnings, wallPx: 0, minPx: 0, inkFraction };
  if (inkFraction < 0.002) { warnings.push("На картинке почти нет тёмных линий — это не план или он слишком бледный."); return empty; }
  if (inkFraction > 0.6) { warnings.push("Картинка почти целиком тёмная — похоже на фотографию, а не на план."); return empty; }

  // 2. кляксы — по форме
  const cc = components(ink, w, h);
  const blob = new Uint8Array(cc.comps.length + 1);
  for (let k = 0; k < cc.comps.length; k++) {
    const c = cc.comps[k]; const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    if (Math.min(bw, bh) > 40 && c.count / (bw * bh) > 0.4) blob[k + 1] = 1;
  }
  for (let i = 0; i < n; i++) if (ink[i] && blob[cc.labels[i]]) ink[i] = 0;

  // 3. толщина штриха на гребне
  const d = distance(ink, w, h);
  const thick: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; const v = d[i]; if (!v) continue;
    if (v >= d[i - 1] && v >= d[i + 1] && v >= d[i - w] && v >= d[i + w]) thick.push((2 * v) / 3);
  }
  const wallPx = percentile(thick.filter((t) => t >= 3), 0.95);
  if (!(wallPx >= 4)) {
    warnings.push(`Толстых штрихов на картинке нет (самый толстый ${wallPx.toFixed(1)} px) — стены тоньше 4 px по толщине не найти.`);
    return { ...empty, wallPx };
  }
  const minPx = Math.max(4, 0.25 * wallPx);
  // кляксы второго рода — фотографии и заливки, которые порог не заполнил целиком:
  // у них есть пятно толще двух с половиной стен, у стены такого не бывает
  const maxD = new Int32Array(cc.comps.length + 1);
  for (let i = 0; i < n; i++) if (ink[i] && d[i] > maxD[cc.labels[i]]) maxD[cc.labels[i]] = d[i];
  const пятно = new Uint8Array(cc.comps.length + 1);
  for (let k = 1; k <= cc.comps.length; k++) if ((2 * maxD[k]) / 3 > 2.5 * wallPx) пятно[k] = 1;
  for (let i = 0; i < n; i++) if (ink[i] && пятно[cc.labels[i]]) ink[i] = 0;

  // 4. маска стен = раскрытие радиусом minPx/2: ядро ≥ r, затем расширение на r
  const rr = Math.max(1, Math.round(minPx / 2));
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (ink[i] && d[i] >= rr * 3) core[i] = 1;
  const walls = extrema(core, w, h, rr, true);
  // сшить разрывы скелета до толщины стены: закрытие радиусом wallPx/2 внутри чернил
  const closed = extrema(extrema(walls, w, h, Math.round(wallPx / 2), true), w, h, Math.round(wallPx / 2), false);
  for (let i = 0; i < n; i++) if (closed[i] && ink[i]) walls[i] = 1;

  // 5. план — главная группа + группы от 10 % её
  const coreCount = core.reduce((a, v) => a + v, 0);
  const wc = components(walls, w, h);
  if (wc.comps.length === 0) { warnings.push("Стен по толщине не нашлось."); return { ...empty, wallPx, minPx }; }
  const largest = Math.max(...wc.comps.map((c) => c.count));
  const keep = new Uint8Array(wc.comps.length + 1);
  const m = 3 * wallPx;
  // план — не одна группа: дверные разрывы делят его (LA VIE: V-образное крыло и
  // нижняя часть). Прямоугольник плана — объединение групп от 10 % крупнейшей;
  // мелкие группы (короткие перегородки) — по центру внутри него с запасом в
  // три толщины. Фотографии сбоку от плана не проходят: их сняла проверка на пятно.
  let px0 = w, py0 = h, px1 = 0, py1 = 0;
  wc.comps.forEach((c, k) => { if (c.count >= 0.1 * largest) { keep[k + 1] = 1; px0 = Math.min(px0, c.x0); py0 = Math.min(py0, c.y0); px1 = Math.max(px1, c.x1); py1 = Math.max(py1, c.y1); } });
  wc.comps.forEach((c, k) => {
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    if (!keep[k + 1] && c.count >= 2 * minPx * wallPx && cx >= px0 - m && cx <= px1 + m && cy >= py0 - m && cy <= py1 + m) keep[k + 1] = 1;
  });
  for (let i = 0; i < n; i++) if (walls[i] && !keep[wc.labels[i]]) walls[i] = 0;

  // 6. прямоугольники из построчных прогонов
  interface Rect { x0: number; x1: number; y0: number; y1: number }
  const rects: Rect[] = [];
  let open: Rect[] = [];
  for (let y = 0; y < h; y++) {
    const runs: Array<[number, number]> = [];
    let x = 0;
    while (x < w) {
      if (!walls[y * w + x]) { x++; continue; }
      const s = x; while (x < w && walls[y * w + x]) x++;
      runs.push([s, x - 1]);
    }
    const next: Rect[] = [];
    for (const [a, b] of runs) {
      const o = open.find((q) => Math.abs(q.x0 - a) <= 2 && Math.abs(q.x1 - b) <= 2);
      if (o) { o.y1 = y; open.splice(open.indexOf(o), 1); next.push(o); }
      else next.push({ x0: a, x1: b, y0: y, y1: y });
    }
    rects.push(...open);
    open = next;
  }
  rects.push(...open);

  const ext = 0.6 * wallPx;
  let segs: WallSeg[] = [];
  const covered = new Uint8Array(n);
  for (const q of rects) {
    const rw = q.x1 - q.x0 + 1, rh = q.y1 - q.y0 + 1;
    // осевая стена — длинная сторона от трёх толщин; короче — лесенка косой стены
    // или крошка на стыке, их пиксели остаются остатку для Хафа
    if (Math.max(rw, rh) < 3 * wallPx) continue;
    for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) covered[y * w + x] = 1;
    if (rw >= rh) segs.push({ x1: q.x0 - ext, x2: q.x1 + ext, y1: (q.y0 + q.y1) / 2, y2: (q.y0 + q.y1) / 2, weight: rh, axis: "h" });
    else segs.push({ x1: (q.x0 + q.x1) / 2, x2: (q.x0 + q.x1) / 2, y1: q.y0 - ext, y2: q.y1 + ext, weight: rw, axis: "v" });
  }
  // косые стены: Хаф по гребню остатка маски (точки — локальные максимумы расстояния)
  const pts: Array<[number, number, number]> = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!walls[i] || covered[i]) continue;
    const v = d[i];
    if (v >= rr * 3 && v >= d[i - 1] && v >= d[i + 1] && v >= d[i - w] && v >= d[i + w]) pts.push([x, y, (2 * v) / 3]);
  }
  const hough = houghSegments(pts, wallPx, ext);
  segs.push(...hough);
  // 5б. ПОЛЫЕ стены — две параллельные тонкие линии на расстоянии от minPx до
  // 1.5 толщины (LA VIE: перегородки и часть наружных стен нарисованы контуром
  // со штриховкой, толстой заливки у них нет). Тонкие линии — Хафом по гребню
  // тонких чернил вне маски стен, длиной от трёх толщин; пара с перекрытием
  // по длине от половины даёт стену посередине с толщиной по расстоянию.
  const thin: Array<[number, number, number]> = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!ink[i] || walls[i]) continue;
    const v = d[i];
    if (v >= d[i - 1] && v >= d[i + 1] && v >= d[i - w] && v >= d[i + w] && (2 * v) / 3 < minPx) thin.push([x, y, (2 * v) / 3]);
  }
  // тонкие линии одной стены стоят от minPx друг от друга — дубли снимаем только ближе 3 px
  const inPlan = (x: number, y: number) => x >= px0 - 1.5 * wallPx && x <= px1 + 1.5 * wallPx && y >= py0 - 1.5 * wallPx && y <= py1 + 1.5 * wallPx;
  const thinSegs = houghSegments(thin, wallPx, 0, 3 * wallPx, wallPx, "d", 3)
    // заголовок, фотографии и водяной знак лежат вне прямоугольника плана
    .filter((q) => inPlan((q.x1 + q.x2) / 2, (q.y1 + q.y2) / 2));
  const hollow: WallSeg[] = [];
  const used = new Uint8Array(thinSegs.length);
  const len = (q: WallSeg) => Math.hypot(q.x2 - q.x1, q.y2 - q.y1);
  for (let i = 0; i < thinSegs.length; i++) {
    if (used[i]) continue;
    const a = thinSegs[i]; const la = len(a); if (la === 0) continue;
    const ux = (a.x2 - a.x1) / la, uy = (a.y2 - a.y1) / la; // вдоль a
    let bestJ = -1, bestDist = 0, bestLo = 0, bestHi = 0;
    for (let j = i + 1; j < thinSegs.length; j++) {
      if (used[j]) continue;
      const b = thinSegs[j]; const lb = len(b); if (lb === 0) continue;
      const vx = (b.x2 - b.x1) / lb, vy = (b.y2 - b.y1) / lb;
      if (Math.abs(ux * vx + uy * vy) < Math.cos((3 * Math.PI) / 180)) continue; // не параллельны
      // расстояние от СЕРЕДИНЫ b до прямой a: по концам соседний угол Хафа врёт на градус длины
      const dist = Math.abs(-uy * ((b.x1 + b.x2) / 2 - a.x1) + ux * ((b.y1 + b.y2) / 2 - a.y1));
      if (dist < minPx || dist > 1.5 * wallPx) continue;
      const p0 = 0, p1 = la;
      const q0 = ux * (b.x1 - a.x1) + uy * (b.y1 - a.y1), q1 = ux * (b.x2 - a.x1) + uy * (b.y2 - a.y1);
      const lo = Math.max(p0, Math.min(q0, q1)), hi = Math.min(p1, Math.max(q0, q1));
      if (hi - lo < 0.5 * Math.min(la, lb) || hi - lo < 3 * wallPx) continue;
      if (bestJ < 0 || hi - lo > bestHi - bestLo) { bestJ = j; bestDist = dist; bestLo = lo; bestHi = hi; }
    }
    if (bestJ < 0) continue;
    const b = thinSegs[bestJ];
    // середина между линиями: сдвиг от a на dist/2 в сторону b
    const side = Math.sign(-uy * ((b.x1 + b.x2) / 2 - a.x1) + ux * ((b.y1 + b.y2) / 2 - a.y1)) || 1;
    const ox = -uy * side * (bestDist / 2), oy = ux * side * (bestDist / 2);
    const isH = Math.abs(uy) < 0.05, isV = Math.abs(ux) < 0.05;
    hollow.push({
      x1: a.x1 + ux * (bestLo - ext) + ox, y1: a.y1 + uy * (bestLo - ext) + oy,
      x2: a.x1 + ux * (bestHi + ext) + ox, y2: a.y1 + uy * (bestHi + ext) + oy,
      weight: bestDist, axis: isH ? "h" : isV ? "v" : "d",
    });
    used[i] = 1; used[bestJ] = 1;
  }
  // полая стена рядом с уже найденной толстой (ближе толщины) — её же грань, не нужна
  const nearThick = (q: WallSeg) => segs.some((t) => {
    const cx = (q.x1 + q.x2) / 2, cy = (q.y1 + q.y2) / 2;
    const dx = t.x2 - t.x1, dy = t.y2 - t.y1; const l2 = dx * dx + dy * dy; if (!l2) return false;
    const tt = Math.max(0, Math.min(1, ((cx - t.x1) * dx + (cy - t.y1) * dy) / l2));
    return Math.hypot(cx - (t.x1 + tt * dx), cy - (t.y1 + tt * dy)) < wallPx;
  });
  const hollowKept = hollow.filter((q) => !nearThick(q));
  segs.push(...hollowKept);
  const stats = { inkComps: cc.comps.length, blobs: blob.reduce((a, v) => a + v, 0), spots: пятно.reduce((a, v) => a + v, 0), T, coreCount, wallComps: wc.comps.length, kept: keep.reduce((a, v) => a + v, 0), largest, rects: rects.length, longRects: segs.length - hough.length, ridgePts: pts.length, hough: hough.length, thinPts: thin.length, thinSegs: thinSegs.length, hollow: hollowKept.length };
  // слить коллинеарные с перекрытием или зазором до толщины стены
  const merge = (list: WallSeg[]): WallSeg[] => {
    const out: WallSeg[] = list.filter((s) => s.axis === "d");
    for (const axis of ["h", "v"] as const) {
      const same = list.filter((s) => s.axis === axis).sort((a, b) => (axis === "h" ? a.y1 - b.y1 || a.x1 - b.x1 : a.x1 - b.x1 || a.y1 - b.y1));
      for (const s of same) {
        const last = out.length ? out[out.length - 1] : null;
        if (last && last.axis === axis) {
          const c0 = axis === "h" ? last.y1 : last.x1, c1 = axis === "h" ? s.y1 : s.x1;
          const e0 = axis === "h" ? last.x2 : last.y2, b1 = axis === "h" ? s.x1 : s.y1;
          if (Math.abs(c0 - c1) <= Math.max(2, minPx / 2) && b1 <= e0 + wallPx) {
            if (axis === "h") last.x2 = Math.max(last.x2, s.x2); else last.y2 = Math.max(last.y2, s.y2);
            last.weight = Math.max(last.weight, s.weight); continue;
          }
        }
        out.push({ ...s });
      }
    }
    return out;
  };
  segs = merge(segs);

  // 7. стёкла: тонкие чернила в створе между коллинеарными стенами
  const glass: WallSeg[] = [];
  const inkAt = (x: number, y: number) => { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0; return ink[yi * w + xi]; };
  for (const axis of ["h", "v"] as const) {
    const same = segs.filter((s) => s.axis === axis).sort((a, b) => (axis === "h" ? a.y1 - b.y1 || a.x1 - b.x1 : a.x1 - b.x1 || a.y1 - b.y1));
    for (let i = 0; i + 1 < same.length; i++) {
      const a = same[i], b = same[i + 1];
      const ca = axis === "h" ? a.y1 : a.x1, cb = axis === "h" ? b.y1 : b.x1;
      if (Math.abs(ca - cb) > wallPx) continue;
      const ea = axis === "h" ? a.x2 : a.y2, sb = axis === "h" ? b.x1 : b.y1;
      const gap = sb - ea;
      if (gap < 2 * wallPx || gap > Math.max(w, h) / 3) continue;
      let hit = 0, tot = 0;
      for (let t = ea; t <= sb; t += 2) {
        tot++;
        let any = 0;
        for (let o = -Math.round(wallPx); o <= Math.round(wallPx) && !any; o++) any = axis === "h" ? inkAt(t, ca + o) : inkAt(ca + o, t);
        hit += any;
      }
      if (tot > 0 && hit / tot >= 0.6) {
        glass.push(axis === "h"
          ? { x1: ea, x2: sb, y1: ca, y2: ca, weight: Math.max(2, minPx / 2), axis, glass: true }
          : { x1: ca, x2: ca, y1: ea, y2: sb, weight: Math.max(2, minPx / 2), axis, glass: true });
      }
    }
  }
  segs.push(...glass);
  if (glass.length) warnings.push(`Окна и витражи (${glass.length}) найдены как тонкие линии в створе стен и добавлены стеклом: контур замкнут для площадей, в 3D прозрачные.`);
  warnings.push(`Стены найдены по толщине штриха: наружная ${wallPx.toFixed(0)} px, порог ${minPx.toFixed(0)} px, отрезков ${segs.length - glass.length}. Это предположение по картинке — проверьте и уберите лишнее.`);
  return { segments: segs, warnings, wallPx, minPx, inkFraction, stats, masks: debug ? { ink, walls } : undefined };
}
