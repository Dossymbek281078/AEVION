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
import { isGlassLayer, isWallLayer } from "./wallLayer";

export interface PdfSegments {
  /** страниц в файле и какая взята (1..pages); линий на каждой — чтобы предложить выбор */
  pages?: number;
  page?: number;
  pageSegmentCounts?: number[];
  /** `layer` — имя слоя PDF, если линия лежала внутри метки /OC … BDC. */
  segments: Array<{ x1: number; y1: number; x2: number; y2: number; layer?: string }>;
  warnings: string[];
  /** габарит в пунктах PDF — нужен, чтобы предложить масштаб */
  extentPt: number;
  /** Слои стен, по которым отобраны линии. Пусто — отбора по слою не было. */
  wallLayers?: string[];
  /** линии со слоёв витражей и окон — станут стеклянными стенами (только при отборе по слою) */
  glassSegments?: Array<{ x1: number; y1: number; x2: number; y2: number; layer?: string }>;
  /** сколько линий на каждом слое файла — чтобы видеть, где мебель и сантехника */
  layerCounts?: Record<string, number>;
  /** линии всех слоёв, кроме стен и стекла — мебель, сантехника, размеры (только при отборе по слою) */
  otherSegments?: Array<{ x1: number; y1: number; x2: number; y2: number; layer: string }>;
}

export interface PdfResult {
  plan: Plan | null;
  warnings: string[];
  /** сколько метров приходится на пункт PDF при выбранном масштабе */
  metersPerPt: number;
  extentPt: number;
  truncated: number;
  /** начало координат плана на листе (пункты): точка листа → метры = (p − origin) × metersPerPt */
  originPt?: { x: number; y: number };
}

export const MAX_SEGMENTS = 1500;
/**
 * Потолок, когда линии уже отобраны по слою стен.
 *
 * 400 самых длинных — защита от шума, когда в PDF не видно, что стена. После
 * отбора по слою шума нет, а короткие линии — это настоящие грани стен у
 * проёмов и углов. Настоящий план LA VIE держит на слое «Стены» 1628 линий:
 * прежний потолок выбросил бы три четверти стен.
 */
const MAX_WALL_LAYER_SEGMENTS = 3000;

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

// Пробельные символы PDF (пробел, TAB, LF, CR) — собраны из кодов, чтобы в
// исходнике не было обратных слэшей: на этой машине они съедаются при правке.
const ПРОБЕЛЫ = String.fromCharCode(32, 9, 10, 13);
const ПП = "[" + ПРОБЕЛЫ + "]";

/**
 * Порядок потоков страницы: /Contents [6 0 R 13 0 R 30 0 R] или /Contents 6 0 R.
 *
 * По стандарту PDF потоки одной страницы — это ОДИН поток, разрезанный на части:
 * матрица, заданная в первом без q/Q, действует на все следующие. AutoCAD так и
 * делает: в LA VIE первый поток ставит «0.12 0 0 0.12 18 18 cm», а все стены
 * (1.1 МБ) лежат в третьем. Разбирая части порознь, мы получали стены в «сырых»
 * числах, в 8.3 раза крупнее листа.
 */
function порядокСодержимого(тексты: string[]): number[][] {
  const группы: number[][] = [];
  const массив = new RegExp("/Contents" + ПП + "*[[]([0-9R" + ПРОБЕЛЫ + "]*)]", "g");
  const одна = new RegExp("/Contents" + ПП + "+([0-9]+)" + ПП + "+[0-9]+" + ПП + "+R", "g");
  const ссылка = new RegExp("([0-9]+)" + ПП + "+[0-9]+" + ПП + "+R", "g");
  for (const t of тексты) {
    for (const m of t.matchAll(массив)) группы.push([...m[1].matchAll(ссылка)].map((x) => Number(x[1])));
    for (const m of t.matchAll(одна)) группы.push([Number(m[1])]);
  }
  return группы.filter((g) => g.length > 0);
}

/** Ищет все потоки содержимого и распаковывает Flate-сжатые. У каждого — номер объекта, если он виден. */
async function extractStreams(bytes: Uint8Array): Promise<{ texts: string[]; ids: Array<number | null>; flate: number; other: number }> {
  const texts: string[] = [];
  const ids: Array<number | null> = [];
  const заголовокОбъекта = new RegExp("([0-9]+)" + ПП + "+[0-9]+" + ПП + "+obj", "g");
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
    const окно = new TextDecoder("latin1").decode(hay.subarray(headStart, s));
    // ближайший к слову stream заголовок «N 0 obj» — номер этого потока
    const заголовки = [...окно.matchAll(заголовокОбъекта)];
    const последний = заголовки[заголовки.length - 1];
    const id = последний ? Number(последний[1]) : null;
    // 🔴 Словарь ЭТОГО потока — от его «N 0 obj», а не всё окно в 400 байт.
    // Окно захватывает и словарь СОСЕДНЕГО объекта, а /Length и фильтр ищутся
    // первым совпадением — то есть чужими. Поймано тестом порядка /Contents:
    // поток «0.5 0 0 0.5 0 0 cm» (18 знаков) обрезался по чужой длине 15 и
    // терял оператор cm; так же чужой /FlateDecode отправил бы несжатый поток
    // в распаковку, и он пропал бы молча.
    const head = последний ? окно.slice(последний.index ?? 0) : окно;
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
      if (un) { texts.push(new TextDecoder("latin1").decode(un)); ids.push(id); }
      // битый или не тот вид Flate — не считаем это успехом и не молчим
      else other++;
    } else if (/\/(LZW|DCT|JPX|CCITT|RunLength)Decode/.test(head)) {
      other++;
    } else if (raw.length > 0 && raw.length < 4_000_000) {
      // несжатый поток содержимого
      texts.push(new TextDecoder("latin1").decode(raw));
      ids.push(id);
    }
    pos = e + E.length;
  }
  return { texts, ids, flate, other };
}

/** Разбирает операторы рисования в отрезки. */
/** Линия, как она вышла из потока: с меткой слоя, если лежала внутри /OC … BDC. */
interface СырыйОтрезок { x1: number; y1: number; x2: number; y2: number; oc?: string }

/**
 * Первый проход по потоку содержимого: отрезки и метка слоя у каждого.
 *
 * AutoCAD при печати в PDF оборачивает рисование каждого слоя метками
 * «/OC /oc5 BDC … EMC», а таблица /Properties в ресурсах страницы связывает
 * метку с объектом слоя. Имена (/OC, /oc5) токенизатор теперь видит целиком:
 * прежде «/oc5» распадалось на оператор «oc» и число 5, и слой терялся.
 *
 * Метки бывают и не про слои (текст, артефакты), и вложенными. Поэтому стек:
 * каждая BDC или BMC кладёт своё значение — имя слоя или пустое, — а EMC
 * снимает ровно одно. Текущий слой — ближайший непустой сверху.
 */
function segmentsFromContent(content: string): СырыйОтрезок[] {
  const segs: СырыйОтрезок[] = [];
  const nums: number[] = [];
  const names: string[] = [];
  const метки: Array<string | null> = [];
  const слой = (): string | undefined => {
    for (let k = метки.length - 1; k >= 0; k--) {
      const v = метки[k];
      if (v) return v;
    }
    return undefined;
  };
  const add = (x1: number, y1: number, x2: number, y2: number): void => {
    const oc = слой();
    segs.push(oc !== undefined ? { x1, y1, x2, y2, oc } : { x1, y1, x2, y2 });
  };
  // Матрица преобразования (cm) и её стек (q/Q). Без неё координаты — это числа
  // из потока, а не точки листа: AutoCAD кладёт весь план под «0.12 0 0 0.12 … cm»
  // и каждый повёрнутый блок (двери, мебель, подписи) — под свою матрицу.
  // Замер на LA VIE: 1884 матрицы cm, габарит стен в «сырых» числах 3663 против
  // 440 пт листа, а отрезки внутри повёрнутых блоков ложились не на своё место.
  // Масштаб из размерных надписей считается в пунктах ЛИСТА — значит, и
  // отрезки обязаны быть в них же, иначе ошибка в 8 раз.
  let ctm = [1, 0, 0, 1, 0, 0];
  const стекCtm: number[][] = [];
  const точка = (x: number, y: number): [number, number] =>
    [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  let curX = 0, curY = 0, startX = 0, startY = 0, has = false;
  const re = /(\/[^\s\/\[\]<>(){}%]+)|(-?\d+(?:\.\d+)?)|([A-Za-z']+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1] !== undefined) {
      names.push(m[1]);
      if (names.length > 4) names.shift();
      continue;
    }
    if (m[2] !== undefined) {
      nums.push(parseFloat(m[2]));
      if (nums.length > 8) nums.shift();
      continue;
    }
    const op = m[3];
    if (op === "BDC") {
      const tag = names[names.length - 2];
      const prop = names[names.length - 1];
      метки.push(tag === "/OC" && prop ? prop.slice(1) : null);
    } else if (op === "BMC") {
      метки.push(null);
    } else if (op === "EMC") {
      метки.pop();
    } else if (op === "q") {
      стекCtm.push(ctm.slice());
    } else if (op === "Q") {
      const прежняя = стекCtm.pop();
      if (прежняя) ctm = прежняя;
    } else if (op === "cm" && nums.length >= 6) {
      const [a, b, c, d, e, f] = nums.slice(-6);
      const [A, B, C, D, E, F] = ctm;
      // новая = M × текущая (порядок PDF: сначала матрица из cm, потом прежняя)
      ctm = [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F];
    } else if (op === "m" && nums.length >= 2) {
      [curX, curY] = точка(nums[nums.length - 2], nums[nums.length - 1]);
      startX = curX; startY = curY; has = true;
    } else if (op === "l" && nums.length >= 2 && has) {
      const [x, y] = точка(nums[nums.length - 2], nums[nums.length - 1]);
      add(curX, curY, x, y);
      curX = x; curY = y;
    } else if (op === "re" && nums.length >= 4) {
      const x = nums[nums.length - 4], y = nums[nums.length - 3];
      const w = nums[nums.length - 2], h = nums[nums.length - 1];
      // углы по отдельности: под повёрнутой матрицей прямоугольник остаётся
      // четырёхугольником, а не «x, y, x+w, y+h» в координатах листа
      const p1 = точка(x, y), p2 = точка(x + w, y), p3 = точка(x + w, y + h), p4 = точка(x, y + h);
      add(p1[0], p1[1], p2[0], p2[1]);
      add(p2[0], p2[1], p3[0], p3[1]);
      add(p3[0], p3[1], p4[0], p4[1]);
      add(p4[0], p4[1], p1[0], p1[1]);
      [curX, curY] = p1; startX = p1[0]; startY = p1[1]; has = true;
    } else if (op === "h" && has) {
      add(curX, curY, startX, startY);
      curX = startX; curY = startY;
    } else if (op === "c" || op === "v" || op === "y") {
      if (nums.length >= 2) [curX, curY] = точка(nums[nums.length - 2], nums[nums.length - 1]);
    }
    nums.length = 0;
    names.length = 0;
  }
  return segs;
}

/** Байтовая строка PDF в текст: UTF-16BE с меткой FEFF либо однобайтная. */
function текстИзБайтов(b: number[]): string {
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    let t = "";
    for (let i = 2; i + 1 < b.length; i += 2) t += String.fromCharCode((b[i] << 8) | b[i + 1]);
    return t;
  }
  return String.fromCharCode(...b);
}

/**
 * Имя слоя из записи PDF.
 *
 * Латиницу AutoCAD пишет литеральной строкой «(dim)», всё остальное —
 * шестнадцатеричной в UTF-16: «<FEFF0421…>». Без второй ветки кириллические
 * слои «Стены», «Мебель» не читались бы вовсе, а на планах из Казахстана и
 * России это почти все слои.
 */
function имяСлоя(запись: string): string {
  if (запись.startsWith("<")) {
    const hex = запись.slice(1, -1).replace(/[^0-9A-Fa-f]/g, "");
    const b: number[] = [];
    for (let i = 0; i + 1 < hex.length; i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
    return текстИзБайтов(b);
  }
  const тело = запись.slice(1, -1);
  const b: number[] = [];
  for (let i = 0; i < тело.length; i++) {
    const c = тело.charCodeAt(i);
    if (c !== 92 || i + 1 >= тело.length) { b.push(c & 255); continue; }
    const след = тело[i + 1];
    if (след >= "0" && след <= "7") {
      let окт = "";
      while (окт.length < 3 && i + 1 < тело.length && тело[i + 1] >= "0" && тело[i + 1] <= "7") окт += тело[++i];
      b.push(parseInt(окт, 8) & 255);
      continue;
    }
    i++;
    const упр: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
    b.push(упр[след] ?? (тело.charCodeAt(i) & 255));
  }
  return текстИзБайтов(b);
}

/** Метка слоя в потоке → имя слоя: по объектам /OCG и таблицам /Properties. */
function слоиИзФайла(тексты: string[]): Map<string, string> {
  const имяОбъекта = new Map<string, string>();
  const номерМетки = new Map<string, string>();
  const объект = /(\d+)\s+0\s+obj([^]*?)endobj/g;
  const имя = /\/Name\s*(\((?:[^()\\]|\\[^])*\)|<[0-9A-Fa-f\s]*>)/;
  const свойства = /\/Properties\s*<<([^]*?)>>/g;
  const пара = /\/([^\s\/\[\]<>(){}%]+)\s+(\d+)\s+0\s+R/g;
  for (const t of тексты) {
    for (const o of t.matchAll(объект)) {
      if (!/\/OCG\b/.test(o[2])) continue;
      const n = имя.exec(o[2]);
      if (n) имяОбъекта.set(o[1], имяСлоя(n[1]));
    }
    for (const pr of t.matchAll(свойства)) {
      for (const pa of pr[1].matchAll(пара)) номерМетки.set(pa[1], pa[2]);
    }
  }
  const итог = new Map<string, string>();
  for (const [метка, номер] of номерМетки) {
    const n = имяОбъекта.get(номер);
    if (n !== undefined) итог.set(метка, n);
  }
  return итог;
}

/** Первый проход: что вообще есть в файле. Масштаб ещё не выбран. */
/** Какую страницу многостраничного PDF разбирать (1..pages); без указания — с наибольшим числом линий. */
export interface ReadPdfOptions { page?: number }

export async function readPdfSegments(bytes: Uint8Array, opts: ReadPdfOptions = {}): Promise<PdfSegments> {
  const warnings: string[] = [];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
  if (!head.startsWith("%PDF-")) {
    return { segments: [], warnings: ["Файл не начинается с %PDF- — это не PDF."], extentPt: 0 };
  }
  if (/\/Encrypt\b/.test(new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 200_000))))) {
    return { segments: [], warnings: ["PDF защищён паролем/шифрованием — разобрать нельзя. Сохраните копию без защиты."], extentPt: 0 };
  }

  const { texts, ids, other } = await extractStreams(bytes);
  const весьФайл = new TextDecoder("latin1").decode(bytes);

  // Потоки страницы склеиваем в порядке /Contents (см. порядокСодержимого).
  // Группу берём, только если нашлись ВСЕ её части и ни одна не занята другой
  // страницей; иначе эти потоки разбираются по-старому, по одному.
  const поНомеру = new Map<number, string>();
  ids.forEach((id, i) => { if (id !== null && !поНомеру.has(id)) поНомеру.set(id, texts[i]); });
  const вГруппах = new Set<number>();
  // Каждая группа /Contents — одна СТРАНИЦА. Замер 20.09 на альбомах дизайн-проектов
  // (15 и 45 страниц): без разбора по страницам все листы ложились друг на друга —
  // 0 комнат из 15-страничного альбома, 1 из 45-страничного. Потоки без страницы
  // (формы, старые файлы) идут отдельной «страницей» и берутся, только если она одна.
  const страницы: string[][] = [];
  for (const g of порядокСодержимого([весьФайл, ...texts])) {
    const части = g.map((n) => поНомеру.get(n));
    if (части.some((x) => x === undefined) || g.some((n) => вГруппах.has(n))) continue;
    g.forEach((n) => вГруппах.add(n));
    страницы.push([(части as string[]).join(String.fromCharCode(10))]);
  }
  const безСтраницы: string[] = [];
  texts.forEach((t, i) => { const id = ids[i]; if (id === null || !вГруппах.has(id)) безСтраницы.push(t); });
  if (страницы.length === 0) страницы.push(безСтраницы);
  else if (страницы.length === 1) страницы[0].push(...безСтраницы);

  const порог = (s: СырыйОтрезок) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 0.2;
  // Порог в пунктах ЛИСТА (после матрицы cm). Прежний 1 пт на плане в
  // масштабе LA VIE (42.6 мм/пт) выбрасывал бы всё короче 4 см, включая
  // торцы тонких перегородок; 0.2 пт ≈ 9 мм отсекает только точки.
  const поСтраницам = страницы.map((потоки) => потоки.flatMap((t) => segmentsFromContent(t).filter(порог)));
  const pageSegmentCounts = поСтраницам.map((x) => x.length);
  let page = 1;
  if (страницы.length > 1) {
    const запрошена = opts.page !== undefined && opts.page >= 1 && opts.page <= страницы.length ? opts.page : 0;
    page = запрошена || pageSegmentCounts.indexOf(Math.max(...pageSegmentCounts)) + 1;
    warnings.push(
      `В файле ${страницы.length} страниц — взята страница ${page}${запрошена ? "" : " (на ней больше всего линий)"}. `
      + "Если это не план стен (а, например, план розеток или потолков) — выберите другую страницу.",
    );
  }
  const segments: СырыйОтрезок[] = поСтраницам[page - 1];

  const страничное = { pages: страницы.length, page, pageSegmentCounts };
  if (segments.length === 0) {
    const hint = other > 0
      ? "Похоже, это СКАН: внутри картинка, а не чертёж. Линий в файле нет — распознавание растра будет в следующей версии."
      : "В PDF не нашлось линий (операторы m/l/re). Возможно, чертёж вставлен картинкой.";
    return { segments: [], warnings: [hint], extentPt: 0, ...страничное };
  }

  // Слой стен — первым делом, до габарита: масштаб считается по ГАБАРИТУ, и
  // если в него войдут размерные цепочки и рамка, стены выйдут мельче.
  // Три случая, как в разборе DXF, и на каждый своё честное сообщение.
  const слои = слоиИзФайла([весьФайл, ...texts]);
  const названные = segments.map((s0) => {
    const имя = s0.oc !== undefined ? слои.get(s0.oc) : undefined;
    return имя !== undefined
      ? { x1: s0.x1, y1: s0.y1, x2: s0.x2, y2: s0.y2, layer: имя }
      : { x1: s0.x1, y1: s0.y1, x2: s0.x2, y2: s0.y2 };
  });
  const сИменем = названные.filter((s0) => s0.layer !== undefined);
  const стеновые = сИменем.filter((s0) => isWallLayer(s0.layer as string));
  const перечислить = (имена: string[]): string => {
    const у = [...new Set(имена)];
    return у.slice(0, 4).join(", ") + (у.length > 4 ? ` и ещё ${у.length - 4}` : "");
  };
  let used: PdfSegments["segments"] = названные;
  let wallLayers: string[] = [];
  if (стеновые.length >= 4) {
    used = стеновые;
    wallLayers = [...new Set(стеновые.map((s0) => s0.layer as string))];
    warnings.push(
      `Взят слой стен (${перечислить(wallLayers)}): ${стеновые.length} линий из ${названные.length}. `
      + "Размеры, мебель и оформление лежат на других слоях и в модель не попали.",
    );
  } else if (стеновые.length > 0) {
    warnings.push(
      `Слой стен найден (${перечислить(стеновые.map((s0) => s0.layer as string))}), но на нём всего `
      + `${стеновые.length} лини(й) — для комнаты этого мало, поэтому взяты ВСЕ ${названные.length}. `
      + "Проверьте глазами: размеры и мебель могли стать «стенами».",
    );
  } else if (сИменем.length > 0) {
    warnings.push(
      `В PDF есть слои (${перечислить(сИменем.map((s0) => s0.layer as string))}), но слоя со словом `
      + `«стена/wall» среди них нет — взяты ВСЕ ${названные.length} линий. `
      + "Если стены лежат на слое с другим именем, переименуйте его в CAD.",
    );
  }

  // Витражи и окна — только когда стены взяты по слою: без отбора «всё подряд»
  // и так уже в стенах. Они входят в габарит: витражный фасад стоит на
  // контуре, и без него масштаб считался бы по внутренним стенам.
  const glassSegments = wallLayers.length > 0
    ? сИменем.filter((s0) => isGlassLayer(s0.layer as string))
    : [];
  const layerCounts: Record<string, number> = {};
  for (const s0 of сИменем) layerCounts[s0.layer as string] = (layerCounts[s0.layer as string] ?? 0) + 1;
  const otherSegments = wallLayers.length > 0
    ? (сИменем as Array<{ x1: number; y1: number; x2: number; y2: number; layer: string }>)
      .filter((s0) => !isWallLayer(s0.layer) && !isGlassLayer(s0.layer))
    : [];
  if (glassSegments.length > 0) {
    warnings.push(
      `Витражи и окна (${glassSegments.length} линий со слоя ${перечислить(glassSegments.map((s0) => s0.layer as string))}) `
      + "добавлены как стеклянные стены: они замыкают контур для площадей, в 3D прозрачные, в смету стен не входят.",
    );
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of [...used, ...glassSegments]) {
    minX = Math.min(minX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2); maxY = Math.max(maxY, s.y1, s.y2);
  }
  const extentPt = Math.max(maxX - minX, maxY - minY);

  // Разрыв в геометрии: два куска чертежа далеко друг от друга.
  //
  // Зачем это здесь. Габарит в пунктах — единственное, к чему привязывается
  // масштаб: человек называет длину большей стороны, и по ней считаются ВСЕ
  // размеры и вся смета. Если в файле не один лист, а два (план и штамп,
  // план и экспликация, две страницы подряд), габарит охватывает оба — и
  // каждая стена уменьшается в столько раз, во сколько габарит больше плана.
  //
  // Замер до этой проверки: лист 400 пт + штамп в стороне давали габарит
  // 2400 пт при НУЛЕ предупреждений. Человек вводит «12 м по большей стороне»,
  // и план становится 2 м вместо 12: смета врёт в шесть раз, и ни одного
  // признака на экране.
  //
  // Признак СТРУКТУРНЫЙ, а не про число страниц: страницы мы не разбираем, а
  // один лист вполне может лежать в нескольких потоках. Ищем пустой промежуток
  // по оси — место, где чертежа нет вовсе. У настоящего плана таких дыр
  // шириной в пятую часть листа не бывает: комнаты стоят вплотную.
  // ⚠️ Считать надо покрытие ОТРЕЗКАМИ, а не их серединами. Первая редакция
  // брала середины — и обычный прямоугольник давал «разрыв 50 %»: у четырёх
  // сторон середины естественно разнесены, хотя пустого места нет вовсе.
  // Поймал КОНТРОЛЬ на одном листе, который обязан был молчать.
  const разрыв = (интервалы: Array<[number, number]>, всего: number): number => {
    if (интервалы.length === 0 || всего <= 0) return 0;
    const у = [...интервалы].sort((a2, b2) => a2[0] - b2[0]);
    let конец = у[0][1];
    let макс = 0;
    for (let k = 1; k < у.length; k++) {
      if (у[k][0] > конец) макс = Math.max(макс, у[k][0] - конец);
      конец = Math.max(конец, у[k][1]);
    }
    return макс / всего;
  };
  const поX: Array<[number, number]> = used.map((s2) =>
    [Math.min(s2.x1, s2.x2), Math.max(s2.x1, s2.x2)]);
  const поY: Array<[number, number]> = used.map((s2) =>
    [Math.min(s2.y1, s2.y2), Math.max(s2.y1, s2.y2)]);
  const долиРазрыв = Math.max(
    разрыв(поX, maxX - minX),
    разрыв(поY, maxY - minY),
  );
  if (долиРазрыв >= 0.2) {
    warnings.push(
      `В файле есть пустой промежуток шириной ${Math.round(долиРазрыв * 100)} % листа — `
      + "похоже, это не один план, а несколько частей (лист со штампом, "
      + "экспликация, вторая страница). Габарит считается по ВСЕМУ содержимому, "
      + "поэтому названная вами длина большей стороны растянется на всё сразу, "
      + "и модель выйдет мельче настоящей. Сохраните в PDF только лист плана.",
    );
  }

  if (other > 0) {
    warnings.push(`Часть содержимого пропущена (${other} поток(ов) картинок или неподдержанного сжатия).`);
  }
  return { segments: used, warnings, extentPt, wallLayers, glassSegments, layerCounts, otherSegments, ...страничное };
}

/**
 * Второй проход: строит план, ЗНАЯ реальную длину габарита в метрах.
 *
 * `knownExtentM` задаёт человек («самая длинная стена ≈ 12 м»). Без него
 * плана не будет: масштаб PDF не хранит, и угадывание дало бы правдоподобно
 * неверную модель.
 */
export function planFromPdfSegments(
  src: PdfSegments,
  knownExtentM: number,
  /** откуда габарит: назвал человек или посчитан по размерным числам чертежа */
  источникМасштаба: "человек" | "размеры" = "человек",
  /** прямоугольник плана на листе (пт): линии вне него — рамка, легенда, таблицы */
  область?: { x0: number; y0: number; x1: number; y1: number } | null,
): PdfResult {
  const warnings = [...src.warnings];
  // Только для PDF БЕЗ слоя стен: со слоем стены точные и лишнего нет, а размерные
  // цепочки не обязаны окружать весь план (LA VIE 20.09: обрезка отрезала кухню, 11 → 7 комнат).
  if (область && (src.wallLayers?.length ?? 0) === 0) {
    const внутри = (x: number, y: number) => x >= область.x0 && x <= область.x1 && y >= область.y0 && y <= область.y1;
    const до = src.segments.length;
    const оставить = src.segments.filter((s) => внутри(s.x1, s.y1) && внутри(s.x2, s.y2));
    if (оставить.length >= 4 && оставить.length < до) {
      src = { ...src, segments: оставить, glassSegments: (src.glassSegments ?? []).filter((s) => внутри(s.x1, s.y1) && внутри(s.x2, s.y2)) };
      warnings.push(`План найден по размерным цепочкам: вне их прямоугольника ${до - оставить.length} линий (рамка, легенда, таблицы) — в модель не взяты.`);
    }
  }
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

  const стекло = src.glassSegments ?? [];
  let minX = Infinity, minY = Infinity;
  for (const s of [...src.segments, ...стекло]) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
  }

  let list = src.segments;
  let truncated = 0;
  // После отбора по слою короткие линии — настоящие грани стен, резать их нельзя.
  const поСлою = (src.wallLayers?.length ?? 0) > 0;
  // PDF без слоёв (замер 20.09 на обмерном плане Belmont, 56 тыс. линий): рамка листа
  // становилась «комнатой» на 48 м², а выноска через весь лист резала план. Два признака,
  // безвредные для простой коробки (у неё наружные стены и есть габарит):
  //  • рамка — линии ровно по краю общего прямоугольника, когда внутри есть своё содержимое
  //    (≥ 50 линий) с отступом от края ≥ 3 % по всем четырём сторонам;
  //  • выноска — линия длиннее любой стороны листа: так лежат только диагонали.
  if (!поСлою && list.length > 0) {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const s of list) { bx0 = Math.min(bx0, s.x1, s.x2); by0 = Math.min(by0, s.y1, s.y2); bx1 = Math.max(bx1, s.x1, s.x2); by1 = Math.max(by1, s.y1, s.y2); }
    const W = bx1 - bx0, H = by1 - by0, eps = 0.005 * Math.max(W, H);
    const сторона = Math.max(W, H) * 1.02;
    const безВыносок = list.filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) <= сторона);
    if (безВыносок.length < list.length) {
      warnings.push(`Линии длиннее листа (выноски через весь чертёж): ${list.length - безВыносок.length} — не стены, выброшены.`);
      list = безВыносок;
      const наКраю = (s: PdfSegments["segments"][number]) =>
      (Math.abs(s.x1 - bx0) < eps && Math.abs(s.x2 - bx0) < eps) || (Math.abs(s.x1 - bx1) < eps && Math.abs(s.x2 - bx1) < eps) ||
      (Math.abs(s.y1 - by0) < eps && Math.abs(s.y2 - by0) < eps) || (Math.abs(s.y1 - by1) < eps && Math.abs(s.y2 - by1) < eps);
    const внутри = list.filter((s) => !наКраю(s));
    if (внутри.length >= 50 && внутри.length < list.length) {
      let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
      for (const s of внутри) { ix0 = Math.min(ix0, s.x1, s.x2); iy0 = Math.min(iy0, s.y1, s.y2); ix1 = Math.max(ix1, s.x1, s.x2); iy1 = Math.max(iy1, s.y1, s.y2); }
      if (ix0 - bx0 >= 0.03 * W && bx1 - ix1 >= 0.03 * W && iy0 - by0 >= 0.03 * H && by1 - iy1 >= 0.03 * H) {
        warnings.push(`Рамка листа: ${list.length - внутри.length} линий по краю чертежа — не стены, выброшены.`);
        list = внутри;
      }
    }
  }
  }
  const предел = поСлою ? MAX_WALL_LAYER_SEGMENTS : MAX_SEGMENTS;
  if (list.length > предел) {
    list = [...list]
      .sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))
      .slice(0, предел);
    truncated = src.segments.length - предел;
    warnings.push(`Линий больше ${предел}: показаны ${предел} самых длинных, отброшено ${truncated}.`);
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
  if (сведение.dropped > 0) {
    warnings.push(
      `Одинаковых стен, начерченных дважды: ${сведение.dropped} — выброшены. `
      + "Иначе розетки, кабель и площадь посчитались бы по ним ещё раз.",
    );
  }

  // ⚠️ Разбор DXF отбирает отрезки по слою стен и ЧЕСТНО предупреждает, когда
  // такого слоя не нашлось: «размерные линии могли стать стенами». Здесь
  // отбора нет вовсе — в потоке содержимого PDF слоёв не видно, — и до
  // 09.09.2026 путь PDF об этом МОЛЧАЛ. Два пути делали одинаково рискованную
  // вещь, а признавался в этом только один.
  // «Не видно, что стена» — правда только без отбора по слою. После отбора
  // слой уже назван предупреждением выше, и эта фраза стала бы ложью.
  if (!поСлою) {
    warnings.push(
      `Взяты ВСЕ ${walls.length} линий: в PDF не видно, что стена, а что размер, `
      + "мебель или рамка чертежа. Лишнее станет «стенами» — посмотрите модель "
      + "глазами, прежде чем считать по ней закупку.",
    );
  }

  warnings.push(
    источникМасштаба === "размеры"
      ? `Масштаб взят из размерных чисел чертежа: большая сторона плана ${knownExtentM} м. `
        + "Если размеры не сходятся, поправьте это число."
      : "PDF не хранит масштаб чертежа — модель построена по указанному вами габариту "
        + `${knownExtentM} м. Если размеры не сходятся, поправьте это число.`,
  );

  // Стеклянные стены — ПОСЛЕ сведения двойных линий: витраж начерчен одной
  // линией, и сводить его не с чем, а спутать с гранью настоящей стены можно.
  const стеклянные: Wall[] = [];
  for (const s of стекло) {
    const w: Wall = {
      x1: (s.x1 - minX) * metersPerPt,
      y1: (s.y1 - minY) * metersPerPt,
      x2: (s.x2 - minX) * metersPerPt,
      y2: (s.y2 - minY) * metersPerPt,
      thickness: 0.06,
      height: WALL_HEIGHT,
      glass: true,
    };
    if (Math.hypot(w.x2 - w.x1, w.y2 - w.y1) >= 0.05) стеклянные.push(w);
  }

  return {
    plan: { name: "Импорт PDF", walls: [...сведение.walls, ...стеклянные], openings: [], source: "pdf" },
    warnings,
    metersPerPt,
    extentPt: src.extentPt,
    truncated,
    // начало координат плана на листе: подписи комнат из текста PDF переводятся
    // в метры тем же сдвигом и масштабом, что и стены
    originPt: { x: minX, y: minY },
  };
}
