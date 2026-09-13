/**
 * QSpace — распознавание стен на РАСТРОВОМ плане (JPEG, PNG, скан PDF-страницы).
 *
 * Третий формат из просьбы основателя. Без нейросети и без внешних библиотек:
 * на планировках стены — это длинные тёмные прямые, и они находятся честным
 * обходом пикселей. Метод описан ниже целиком, чтобы результат можно было
 * оспорить, а не принимать на веру.
 *
 * Порядок:
 *   1. яркость каждого пикселя -> «тёмный / светлый» по порогу;
 *   2. поиск горизонтальных и вертикальных ПРОГОНОВ тёмных пикселей;
 *   3. прогоны короче порога отбрасываются (буквы, размерные стрелки, шум);
 *   4. параллельные прогоны рядом сливаются в один (стена нарисована двумя
 *      линиями — её внутренняя и внешняя грань).
 *
 * 🔴 ЧЕСТНАЯ ГРАНИЦА, и она обязана быть на экране:
 *   - это ПРЕДПОЛОЖЕНИЕ, а не чертёж. Результат показывается поверх картинки,
 *     и человек правит его до подтверждения. Молча строить 3D по распознанному
 *     нельзя: ошибка распознавания превратится в тихо неверную модель.
 *   - косые стены находятся только если они идут по осям; диагонали и скругления
 *     не распознаются;
 *   - масштаб из картинки НЕИЗВЕСТЕН — как и у PDF, его называет человек.
 */

export interface RasterSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** толщина найденной линии в пикселях — по ней видно, стена это или выноска */
  weight: number;
  axis: "h" | "v";
}

export interface RasterOptions {
  /** порог «тёмного»: 0..255 по яркости. Ниже — считаем чернилами. */
  darkThreshold?: number;
  /** минимальная длина линии в долях от меньшей стороны картинки */
  minLenFrac?: number;
  /** на каком расстоянии (px) параллельные линии считаются одной стеной */
  mergeGapPx?: number;
}

export interface RasterResult {
  segments: RasterSegment[];
  warnings: string[];
  width: number;
  height: number;
  /** доля тёмных пикселей — по ней видно, что за картинка пришла */
  inkFraction: number;
}

const DEFAULTS = {
  darkThreshold: 128,
  minLenFrac: 0.08,
  mergeGapPx: 12,
};

/** Яркость по стандартной формуле восприятия. */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Находит прямые стены на изображении.
 *
 * `data` — RGBA как из `ctx.getImageData().data`. Функция чистая: ни canvas,
 * ни DOM внутри, поэтому проверяется тестами без браузера.
 */
export function findWallSegments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: RasterOptions = {},
): RasterResult {
  const o = { ...DEFAULTS, ...opts };
  const warnings: string[] = [];

  if (width < 20 || height < 20) {
    return { segments: [], warnings: ["Картинка меньше 20×20 точек — распознавать нечего."], width, height, inkFraction: 0 };
  }

  // --- 1. бинаризация ------------------------------------------------------
  const dark = new Uint8Array(width * height);
  let inked = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    // прозрачное считаем фоном, а не чернилами: у PNG с альфой иначе весь
    // фон окажется «тёмным» и найдутся стены по краю картинки
    const isDark = a > 32 && luma(data[i], data[i + 1], data[i + 2]) < o.darkThreshold;
    if (isDark) { dark[p] = 1; inked++; }
  }
  const inkFraction = inked / (width * height);

  if (inkFraction < 0.001) {
    return { segments: [], warnings: ["На картинке почти нет тёмных линий — возможно, это пустой или очень светлый скан."], width, height, inkFraction };
  }
  if (inkFraction > 0.6) {
    return {
      segments: [],
      warnings: ["Больше 60 % картинки тёмное — похоже на фотографию или инверсный скан, а не на чертёж. Стены так не найти."],
      width,
      height,
      inkFraction,
    };
  }

  const minLen = Math.max(12, Math.round(Math.min(width, height) * o.minLenFrac));
  const raw: RasterSegment[] = [];

  // --- 2. горизонтальные прогоны ------------------------------------------
  for (let y = 0; y < height; y++) {
    let run = 0;
    for (let x = 0; x <= width; x++) {
      const on = x < width && dark[y * width + x] === 1;
      if (on) { run++; continue; }
      if (run >= minLen) raw.push({ x1: x - run, y1: y, x2: x - 1, y2: y, weight: 1, axis: "h" });
      run = 0;
    }
  }

  // --- 3. вертикальные прогоны ---------------------------------------------
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let y = 0; y <= height; y++) {
      const on = y < height && dark[y * width + x] === 1;
      if (on) { run++; continue; }
      if (run >= minLen) raw.push({ x1: x, y1: y - run, x2: x, y2: y - 1, weight: 1, axis: "v" });
      run = 0;
    }
  }

  if (raw.length === 0) {
    return {
      segments: [],
      warnings: [`Прямых линий длиннее ${minLen} точек не найдено. Если план нарисован от руки или под углом, распознавание не поможет.`],
      width,
      height,
      inkFraction,
    };
  }

  // --- 4. слияние параллельных линий в стены -------------------------------
  const merged = mergeParallel(raw.filter((s) => s.axis === "h"), "h", o.mergeGapPx)
    .concat(mergeParallel(raw.filter((s) => s.axis === "v"), "v", o.mergeGapPx));

  warnings.push(
    `Найдено ${merged.length} линий (из ${raw.length} сырых прогонов). `
    + "Это ПРЕДПОЛОЖЕНИЕ по картинке — проверьте и поправьте перед построением модели.",
  );

  return { segments: merged, warnings, width, height, inkFraction };
}

/**
 * Сливает соседние параллельные прогоны.
 *
 * Стена на чертеже нарисована двумя линиями (грани), плюс толстая линия даёт
 * несколько соседних строк пикселей. Без слияния одна стена превратилась бы в
 * десяток «стен» — и спецификация посчитала бы их все.
 */
function mergeParallel(list: RasterSegment[], axis: "h" | "v", gap: number): RasterSegment[] {
  if (list.length === 0) return [];
  // ключ поперёк оси: у горизонтальных — y, у вертикальных — x
  const across = (s: RasterSegment) => (axis === "h" ? s.y1 : s.x1);
  const alongStart = (s: RasterSegment) => (axis === "h" ? Math.min(s.x1, s.x2) : Math.min(s.y1, s.y2));
  const alongEnd = (s: RasterSegment) => (axis === "h" ? Math.max(s.x1, s.x2) : Math.max(s.y1, s.y2));

  const sorted = [...list].sort((a, b) => across(a) - across(b) || alongStart(a) - alongStart(b));
  const out: RasterSegment[] = [];

  for (const s of sorted) {
    const hit = out.find(
      (m) =>
        Math.abs(across(m) - across(s)) <= gap &&
        // отрезки должны перекрываться вдоль оси, иначе это разные стены
        alongStart(s) <= alongEnd(m) + gap &&
        alongEnd(s) >= alongStart(m) - gap,
    );
    if (!hit) {
      out.push({ ...s });
      continue;
    }
    // расширяем найденную стену и запоминаем её толщину
    const a0 = Math.min(alongStart(hit), alongStart(s));
    const a1 = Math.max(alongEnd(hit), alongEnd(s));
    hit.weight = Math.max(hit.weight, Math.abs(across(hit) - across(s)) + 1);
    if (axis === "h") {
      hit.x1 = a0; hit.x2 = a1;
    } else {
      hit.y1 = a0; hit.y2 = a1;
    }
  }
  return out;
}
