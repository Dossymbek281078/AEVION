/**
 * QSpace — извлечение линий плана из ВЕКТОРНОГО PDF, без внешних библиотек.
 *
 * Зачем без библиотеки: pdfjs весит несколько мегабайт и тянет воркер. Нам
 * нужен один частный случай — чертёж, экспортированный из AutoCAD/Revit в
 * PDF: там геометрия лежит в потоке содержимого обычными операторами
 * `m` (moveto), `l` (lineto), `re` (rectangle), а сжата почти всегда
 * FlateDecode. Распаковку даёт сам браузер (DecompressionStream), поэтому
 * зависимостей ноль.
 *
 * 🔴 ЧЕСТНАЯ ГРАНИЦА, и она написана на странице тоже:
 *  - РАСТРОВЫЙ PDF (скан, картинка внутри) не разбирается ВООБЩЕ — в нём нет
 *    линий, только пиксели. Такой файл честно отвергается с объяснением, а не
 *    молча даёт пустой план.
 *  - кривые Безье (`c`, `v`, `y`) пропускаются: стены ими не рисуют.
 *  - PDF со сжатием, отличным от Flate (LZW, шифрование), не поддержан.
 *  - единицы PDF — пункты (1/72 дюйма); реальный масштаб чертежа из файла
 *    НЕИЗВЕСТЕН, поэтому пользователь обязан указать длину известной стены.
 *    Молча угадывать масштаб нельзя: ошибка масштаба — тихая неверная модель.
 */

import type { Plan, Wall } from "./planModel";
import { WALL_HEIGHT } from "./planModel";
import { mergeDoubleWalls } from "./wallMerge";

export interface PdfSegments {
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  warnings: string[];
  /** габарит в пунктах PDF — нужен, чтобы предложить масштаб */
  extentPt: number;
}

export interface PdfResult {
  plan: Plan | null;
  warnings: string[];
  /** сколько метров приходится на пункт PDF при выбранном масштабе */
  metersPerPt: number;
  extentPt: number;
  truncated: number;
}

const MAX_SEGMENTS = 400;

/**
 * Распаковка Flate средствами платформы.
 *
 * Через ReadableStream, а НЕ через `new Blob([...]).stream()`: последний есть
 * в браузере, но отсутствует в среде тестов (jsdom) — то есть код был бы
 * непроверяемым ровно в самой важной ветке. Поймано собственным тестом.
 *
 * PDF-потоки бывают и в raw-deflate без zlib-заголовка, поэтому пробуем оба
 * формата. Не получилось — возвращаем null, а не пустую строку: «не смог
 * распаковать» и «распаковал в пустоту» это разные исходы.
 */
async function inflate(raw: Uint8Array): Promise<Uint8Array | null> {
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      // Пишем в writable напрямую, без pipeThrough: у DecompressionStream
      // входной тип BufferSource, и pipeThrough<Uint8Array> на нём не сходится
      // по типам (поймано боевой сборкой, не тестами).
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      // Копия в собственный ArrayBuffer: `raw` — это subarray чужого буфера
      // (тип Uint8Array<ArrayBufferLike>), который не подходит под BufferSource.
      const chunk = new Uint8Array(raw.length);
      chunk.set(raw);
      const pump = writer.write(chunk).then(() => writer.close());
      void pump.catch(() => {});
      const reader = ds.readable.getReader();
      const parts: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) { parts.push(value); total += value.length; }
      }
      if (total === 0) continue;
      const merged = new Uint8Array(total);
      let at = 0;
      for (const p of parts) { merged.set(p, at); at += p.length; }
      return merged;
    } catch {
      // пробуем следующий формат
    }
  }
  return null;
}

/** Ищет все потоки содержимого и распаковывает Flate-сжатые. */
async function extractStreams(bytes: Uint8Array): Promise<{ texts: string[]; flate: number; other: number }> {
  const texts: string[] = [];
  let flate = 0;
  let other = 0;

  // Ищем последовательности "stream" ... "endstream" по сырым байтам.
  const hay = bytes;
  const S = new TextEncoder().encode("stream");
  const E = new TextEncoder().encode("endstream");

  const indexOfSeq = (from: number, needle: Uint8Array): number => {
    outer: for (let i = from; i <= hay.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
      return i;
    }
    return -1;
  };

  let pos = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const s = indexOfSeq(pos, S);
    if (s < 0) break;
    const e = indexOfSeq(s + S.length, E);
    if (e < 0) break;

    // заголовок словаря перед stream — смотрим фильтр
    const headStart = Math.max(0, s - 400);
    const head = new TextDecoder("latin1").decode(hay.subarray(headStart, s));
    let start = s + S.length;
    // после "stream" идёт CRLF или LF
    if (hay[start] === 0x0d && hay[start + 1] === 0x0a) start += 2;
    else if (hay[start] === 0x0a) start += 1;
    // ⚠️ Между данными и словом `endstream` PDF ставит перевод строки, и он
    // НЕ является частью потока. Взяв его в данные, распаковка падает на
    // КАЖДОМ настоящем файле (поймано тестом с реальным Flate). Точную длину
    // даёт /Length из словаря; если его нет — срезаем хвостовой EOL.
    let end = e;
    // ⚠️ /Length бывает КОСВЕННОЙ ссылкой: «/Length 12 0 R» — это номер
    // объекта, а не размер. Взяв его за длину, мы обрезали бы поток до
    // 12 байт, распаковка бы упала, и обычный PDF был бы объявлен сканом.
    // Поэтому берём число, только если за ним НЕ идёт «<цифры> R».
    // Опережающая проверка тут не годится: движок отступает и берёт «1»
    // вместо «12», снова обрезая поток. Поэтому ссылка ловится ЯВНОЙ
    // необязательной группой, и её наличие отменяет длину.
    const lm = /\/Length\s+(\d+)(\s+\d+\s+R)?/.exec(head);
    const lenM = lm && !lm[2] ? lm : null;
    if (lenM) {
      const n = parseInt(lenM[1], 10);
      if (n > 0 && start + n <= e) end = start + n;
    } else {
      while (end > start && (hay[end - 1] === 0x0a || hay[end - 1] === 0x0d)) end--;
    }
    const raw = hay.subarray(start, end);

    if (/\/FlateDecode/.test(head)) {
      flate++;
      const un = await inflate(raw);
      if (un) texts.push(new TextDecoder("latin1").decode(un));
      // битый или не тот вид Flate — не считаем это успехом и не молчим
      else other++;
    } else if (/\/(LZW|DCT|JPX|CCITT|RunLength)Decode/.test(head)) {
      other++;
    } else if (raw.length > 0 && raw.length < 4_000_000) {
      // несжатый поток содержимого
      texts.push(new TextDecoder("latin1").decode(raw));
    }
    pos = e + E.length;
  }
  return { texts, flate, other };
}

/** Разбирает операторы рисования в отрезки. */
function segmentsFromContent(content: string): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const nums: number[] = [];
  let curX = 0, curY = 0, startX = 0, startY = 0, has = false;

  // Токенизация: числа и односимвольные операторы m/l/re/h/c/v/y
  const re = /(-?\d+(?:\.\d+)?)|([A-Za-z']+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1] !== undefined) {
      nums.push(parseFloat(m[1]));
      if (nums.length > 8) nums.shift();
      continue;
    }
    const op = m[2];
    if (op === "m" && nums.length >= 2) {
      curX = nums[nums.length - 2]; curY = nums[nums.length - 1];
      startX = curX; startY = curY; has = true;
    } else if (op === "l" && nums.length >= 2 && has) {
      const x = nums[nums.length - 2], y = nums[nums.length - 1];
      segs.push({ x1: curX, y1: curY, x2: x, y2: y });
      curX = x; curY = y;
    } else if (op === "re" && nums.length >= 4) {
      const x = nums[nums.length - 4], y = nums[nums.length - 3];
      const w = nums[nums.length - 2], h = nums[nums.length - 1];
      segs.push({ x1: x, y1: y, x2: x + w, y2: y });
      segs.push({ x1: x + w, y1: y, x2: x + w, y2: y + h });
      segs.push({ x1: x + w, y1: y + h, x2: x, y2: y + h });
      segs.push({ x1: x, y1: y + h, x2: x, y2: y });
      curX = x; curY = y; startX = x; startY = y; has = true;
    } else if (op === "h" && has) {
      segs.push({ x1: curX, y1: curY, x2: startX, y2: startY });
      curX = startX; curY = startY;
    } else if (op === "c" || op === "v" || op === "y") {
      // кривая: конечную точку берём, саму дугу не строим
      if (nums.length >= 2) { curX = nums[nums.length - 2]; curY = nums[nums.length - 1]; }
    }
    nums.length = 0;
  }
  return segs;
}

/** Первый проход: что вообще есть в файле. Масштаб ещё не выбран. */
export async function readPdfSegments(bytes: Uint8Array): Promise<PdfSegments> {
  const warnings: string[] = [];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
  if (!head.startsWith("%PDF-")) {
    return { segments: [], warnings: ["Файл не начинается с %PDF- — это не PDF."], extentPt: 0 };
  }
  if (/\/Encrypt\b/.test(new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 200_000))))) {
    return { segments: [], warnings: ["PDF защищён паролем/шифрованием — разобрать нельзя. Сохраните копию без защиты."], extentPt: 0 };
  }

  const { texts, other } = await extractStreams(bytes);
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (const t of texts) {
    for (const s of segmentsFromContent(t)) {
      if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 1) segments.push(s);
    }
  }

  if (segments.length === 0) {
    const hint = other > 0
      ? "Похоже, это СКАН: внутри картинка, а не чертёж. Линий в файле нет — распознавание растра будет в следующей версии."
      : "В PDF не нашлось линий (операторы m/l/re). Возможно, чертёж вставлен картинкой.";
    return { segments: [], warnings: [hint], extentPt: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of segments) {
    minX = Math.min(minX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2); maxY = Math.max(maxY, s.y1, s.y2);
  }
  const extentPt = Math.max(maxX - minX, maxY - minY);

  if (other > 0) {
    warnings.push(`Часть содержимого пропущена (${other} поток(ов) картинок или неподдержанного сжатия).`);
  }
  return { segments, warnings, extentPt };
}

/**
 * Второй проход: строит план, ЗНАЯ реальную длину габарита в метрах.
 *
 * `knownExtentM` задаёт человек («самая длинная стена ≈ 12 м»). Без него
 * плана не будет: масштаб PDF не хранит, и угадывание дало бы правдоподобно
 * неверную модель.
 */
export function planFromPdfSegments(src: PdfSegments, knownExtentM: number): PdfResult {
  const warnings = [...src.warnings];
  if (src.segments.length === 0 || src.extentPt <= 0) {
    return { plan: null, warnings, metersPerPt: 0, extentPt: src.extentPt, truncated: 0 };
  }
  if (!(knownExtentM > 0.5) || !(knownExtentM < 500)) {
    return {
      plan: null,
      warnings: [...warnings, "Укажите габарит плана в метрах (от 0.5 до 500) — без него масштаб неизвестен."],
      metersPerPt: 0,
      extentPt: src.extentPt,
      truncated: 0,
    };
  }

  const metersPerPt = knownExtentM / src.extentPt;

  let minX = Infinity, minY = Infinity;
  for (const s of src.segments) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
  }

  let list = src.segments;
  let truncated = 0;
  if (list.length > MAX_SEGMENTS) {
    list = [...list]
      .sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))
      .slice(0, MAX_SEGMENTS);
    truncated = src.segments.length - MAX_SEGMENTS;
    warnings.push(`Линий больше ${MAX_SEGMENTS}: показаны ${MAX_SEGMENTS} самых длинных, отброшено ${truncated}.`);
  }

  const walls: Wall[] = [];
  for (const s of list) {
    const w: Wall = {
      x1: (s.x1 - minX) * metersPerPt,
      y1: (s.y1 - minY) * metersPerPt,
      x2: (s.x2 - minX) * metersPerPt,
      y2: (s.y2 - minY) * metersPerPt,
      thickness: 0.15,
      height: WALL_HEIGHT,
    };
    if (Math.hypot(w.x2 - w.x1, w.y2 - w.y1) < 0.05) continue;
    walls.push(w);
  }

  if (walls.length === 0) {
    return {
      plan: null,
      warnings: [...warnings, "После пересчёта масштаба стен не осталось (все линии короче 5 см)."],
      metersPerPt,
      extentPt: src.extentPt,
      truncated,
    };
  }

  // Та же манера черчения, что и в DXF: чертёж пришёл из той же программы,
  // просто напечатан в PDF. Сведение общим механизмом, а не второй копией
  // правила — иначе два пути разойдутся молча.
  const сведение = mergeDoubleWalls(walls);
  if (сведение.merged > 0) {
    const толщины = сведение.walls
      .filter((w) => Math.abs(w.thickness - 0.15) > 1e-9)
      .map((w) => w.thickness);
    const мин = Math.min(...толщины), макс = Math.max(...толщины);
    warnings.push(
      `Стены начерчены двумя линиями — ${сведение.merged} пар сведены в одну стену каждая. `
      + `Толщина взята из чертежа: ${мин === макс ? `${мин.toFixed(2)} м` : `${мин.toFixed(2)}–${макс.toFixed(2)} м`}, `
      + "а не типовые 0.15 м. Если у вас были ДВЕ отдельные стены рядом — сверьте с чертежом.",
    );
  }

  warnings.push(
    "PDF не хранит масштаб чертежа — модель построена по указанному вами габариту "
    + `${knownExtentM} м. Если размеры не сходятся, поправьте это число.`,
  );

  return {
    plan: { name: "Импорт PDF", walls: сведение.walls, openings: [], source: "pdf" },
    warnings,
    metersPerPt,
    extentPt: src.extentPt,
    truncated,
  };
}
