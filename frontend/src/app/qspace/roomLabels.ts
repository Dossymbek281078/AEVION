import type { ЭлементТекста } from "./dimensionScale";
import type { RoomType } from "./roomTypes";

/**
 * Подписи комнат из текста PDF: «Кухня», «Мастер спальня», «Детский санузел».
 *
 * Основатель 15.09: «нет распознавания комнат по типу, там же были указаны
 * названия». Были — но CAD пишет подписи ПО ОДНОЙ БУКВЕ, а в LA VIE ещё и
 * справа налево (глифы в потоке идут с убывающим x): собранные по x слова
 * выходили зеркальными («янхуК»). Здесь буквы собираются в слова по базовой
 * линии и шагу, направление определяется по порядку глифов, слова — в строки,
 * строки одной подписи — по вертикальному шагу.
 */
export interface Подпись {
  text: string;
  /** центр подписи в координатах листа PDF (пункты) */
  x: number;
  y: number;
}

const СЛОВАРЬ: Array<[RegExp, RoomType]> = [
  [/(с\/у|сан ?узел|санузл|ванн|туалет|душ|wc|bath|toilet)/i, "bath"],
  [/(кухн|kitchen|столов)/i, "kitchen"],
  [/(спальн|детск|bedroom|кабинет)/i, "bedroom"],
  [/(гостин|зал|living)/i, "living"],
  [/(холл|прихож|коридор|тамбур|гардероб|прачечн|кладов|постирочн|hall|entry)/i, "hall"],
];

/** Тип комнаты по подписи; null — подпись не про комнату (мебель, штамп, заголовок). */
export function roomTypeFromLabel(text: string): RoomType | null {
  for (const [re, t] of СЛОВАРЬ) if (re.test(text)) return t;
  return null;
}

interface Глиф { c: string; x: number; y: number; w: number; size: number; order: number }

/**
 * Собирает подписи из элементов pdf.js. Учитываются только горизонтальные
 * элементы (размерные числа стоят вдоль стен под любым углом — их сюда не надо).
 */
export function подписиИзТекста(items: ЭлементТекста[]): Подпись[] {
  const глифы: Глиф[] = [];
  items.forEach((it, order) => {
    const t = it.transform;
    if (!t || t.length < 6) return;
    if (Math.abs(t[1]) > 0.05 * Math.abs(t[0])) return; // повёрнутый текст
    const size = Math.abs(t[3]) || Math.abs(t[0]);
    if (!(size > 0)) return;
    const s = it.str ?? "";
    if (!s.trim()) return;
    // элемент бывает и словом целиком, и одной буквой — оба случая ниже
    глифы.push({ c: s, x: t[4], y: t[5], w: it.width > 0 ? it.width : size * 0.6 * s.length, size, order });
  });
  if (глифы.length === 0) return [];

  // 1. буквы → слова: та же базовая линия, тот же кегль, шаг не больше 1.6 кегля
  глифы.sort((a, b) => a.y - b.y || a.x - b.x);
  const слова: Глиф[][] = [];
  for (const g of глифы) {
    let положен = false;
    for (const w of слова) {
      const last = w[w.length - 1];
      const первый = w[0];
      if (Math.abs(last.y - g.y) <= 0.3 * g.size && Math.abs(last.size - g.size) < 0.3 * g.size
        && g.x - last.x >= -0.2 * g.size && g.x - Math.max(...w.map((q) => q.x)) <= 1.6 * g.size
        && g.x >= первый.x - 0.2 * g.size) {
        w.push(g); положен = true; break;
      }
    }
    if (!положен) слова.push([g]);
  }
  interface Слово { text: string; x0: number; x1: number; y: number; size: number; order: number }
  const тексты: Слово[] = слова.map((w) => {
    // Порядок чтения — порядок В ПОТОКЕ, а не по x: CAD пишет буквы в порядке
    // чтения, а в LA VIE ставит их зеркально (первая буква правее всех) — по x
    // слово выходило «янхуК». По x глифы только группируются в слово.
    const поX = [...w].sort((a, b) => a.x - b.x);
    const text = [...w].sort((a, b) => a.order - b.order).map((q) => q.c).join("");
    return { text, x0: поX[0].x, x1: Math.max(...w.map((q) => q.x + q.w)), y: w[0].y, size: w[0].size, order: Math.min(...w.map((q) => q.order)) };
  }).filter((w) => /[A-Za-zА-Яа-яЁё]{2}/.test(w.text));

  // 2. слова одной строки → фраза (промежуток до 2 кеглей: в LA VIE пробел «Мастер спальня» = 1.6), строки одной подписи
  //    → подпись (вертикальный шаг до 1.6 кегля, горизонтальное пересечение)
  тексты.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const строки: Слово[][] = [];
  for (const w of тексты) {
    const s = строки.find((r) => Math.abs(r[r.length - 1].y - w.y) <= 0.3 * w.size && w.x0 - r[r.length - 1].x1 <= 2.0 * w.size && w.x0 >= r[r.length - 1].x0);
    if (s) s.push(w); else строки.push([w]);
  }
  // слова в строке — по порядку потока, как и буквы: в LA VIE «Мастер» стоит ПРАВЕЕ «спальня»
  const фразы = строки.map((r) => ({
    text: [...r].sort((a, b) => a.order - b.order).map((w) => w.text).join(" "), x0: Math.min(...r.map((w) => w.x0)), x1: Math.max(...r.map((w) => w.x1)),
    y: r[0].y, size: r[0].size,
  }));
  const подписи: Array<{ lines: typeof фразы }> = [];
  for (const f of фразы) {
    const p = подписи.find((g) => {
      const last = g.lines[g.lines.length - 1];
      const dy = Math.abs(f.y - last.y);
      const пересекаются = f.x0 <= last.x1 + f.size && f.x1 >= last.x0 - f.size;
      return dy > 0.3 * f.size && dy <= 1.6 * f.size && пересекаются && Math.abs(last.size - f.size) < 0.3 * f.size;
    });
    if (p) p.lines.push(f); else подписи.push({ lines: [f] });
  }
  return подписи.map((g) => {
    const x0 = Math.min(...g.lines.map((l) => l.x0)), x1 = Math.max(...g.lines.map((l) => l.x1));
    const ys = g.lines.map((l) => l.y);
    // строки подписи — сверху вниз по листу (в PDF y растёт вверх, значит по убыванию y)
    const text = [...g.lines].sort((a, b) => b.y - a.y).map((l) => l.text).join(" ");
    return { text, x: (x0 + x1) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  });
}

/**
 * Подписи → назначения комнат. Подпись с известным типом ставится той комнате,
 * в которой стоит её центр (roomAt по метрам). Первая подпись комнаты выигрывает:
 * «Мастер спальня» и «Мастер санузел» лежат в разных комнатах, а «полки» и
 * «термомикс» типа не имеют и комнату не переименовывают.
 */
export function назначенияПоПодписям(
  labels: Подпись[],
  originPt: { x: number; y: number },
  metersPerPt: number,
  roomAt: (x: number, y: number) => number | null,
): { types: Record<number, RoomType>; names: Record<number, string>; unplaced: string[] } {
  const types: Record<number, RoomType> = {};
  const names: Record<number, string> = {};
  const unplaced: string[] = [];
  for (const l of labels) {
    const t = roomTypeFromLabel(l.text);
    if (!t) continue;
    const x = (l.x - originPt.x) * metersPerPt, y = (l.y - originPt.y) * metersPerPt;
    // Подпись бывает на самой границе (LA VIE: «Прачечная», «Мастер санузел» стоят в
    // клетке стены, до комнаты 0.1–0.2 м) — ищем ближайшую комнату по кругу до 0.4 м
    let idx = roomAt(x, y);
    for (let rad = 0.1; idx === null && rad <= 0.4; rad += 0.1) {
      for (let a = 0; a < 360 && idx === null; a += 30) idx = roomAt(x + rad * Math.cos((a * Math.PI) / 180), y + rad * Math.sin((a * Math.PI) / 180));
    }
    if (idx === null) { unplaced.push(l.text); continue; }
    if (idx in types) continue;
    types[idx] = t;
    names[idx] = l.text;
  }
  return { types, names, unplaced };
}

/** Строка экспликации помещений: «№ | Наименование | Площадь». */
export interface СтрокаЭкспликации { n: number; name: string; area?: number }

/** Горизонтальные элементы текста по строкам (одна базовая линия ±2 пт), в порядке x. */
function строкиТекста(items: ЭлементТекста[]): Array<Array<{ s: string; x: number; y: number; size: number }>> {
  const ячейки = items
    .filter((it) => it.transform && it.transform.length >= 6 && Math.abs(it.transform[1]) <= 0.05 * Math.abs(it.transform[0]) && (it.str ?? "").trim())
    .map((it) => ({ s: it.str.trim(), x: it.transform[4], y: it.transform[5], size: Math.abs(it.transform[3]) || Math.abs(it.transform[0]) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const строки: Array<typeof ячейки> = [];
  for (const c of ячейки) {
    const last = строки[строки.length - 1];
    if (last && Math.abs(last[0].y - c.y) <= 2) last.push(c); else строки.push([c]);
  }
  return строки.map((r) => r.sort((a, b) => a.x - b.x));
}

// имя может нести номер («Помещение 1» в обмерных альбомах) — цифры внутри допустимы, но начало — буква
// имя помещения в таблице — с заглавной («Коридор», «Помещение 1»); строки легенды
// («2 | перегородки из бетонных блоков») идут со строчной и таблицей не считаются
const ИМЯ_ПОМЕЩЕНИЯ = /^[А-ЯЁ][А-ЯЁа-яё0-9 \-\/]{2,30}$/;
const ПЛОЩАДЬ = /^(\d{1,4})[,.](\d{1,2})\s*м?/;

/**
 * Таблица экспликации с листа: «1 | Коридор | 6,45», «4 | Кухня-гостиная | 19,08».
 * Замер 20.09 на двух альбомах: OTDL — 6 строк с именами; design-project — «Помещение 1/2»
 * (имена без смысла, но площади есть). Номер — первая ячейка строки из 1–2 цифр, имя —
 * ближайшая кириллическая ячейка справа, площадь — первое число с запятой после имени.
 */
export function экспликацияИзТекста(items: ЭлементТекста[]): СтрокаЭкспликации[] {
  const out = new Map<number, СтрокаЭкспликации>();
  for (const row of строкиТекста(items)) {
    for (let i = 0; i < row.length; i++) {
      if (!/^\d{1,2}$/.test(row[i].s)) continue;
      const n = Number(row[i].s);
      const имя = row.slice(i + 1, i + 3).find((c) => ИМЯ_ПОМЕЩЕНИЯ.test(c.s));
      if (!имя) continue;
      const после = row.slice(row.indexOf(имя) + 1, row.indexOf(имя) + 4).find((c) => ПЛОЩАДЬ.test(c.s));
      const m = после ? ПЛОЩАДЬ.exec(после.s) : null;
      if (!out.has(n)) out.set(n, { n, name: имя.s, area: m ? Number(m[1] + "." + m[2]) : undefined });
      break;
    }
  }
  return [...out.values()].sort((a, b) => a.n - b.n);
}

/**
 * Номера помещений НА ПЛАНЕ: одиночные цифры 1–2 знаков, не в строке таблицы (рядом нет
 * кириллического имени) и не показатель степени у «м²» (мельче обычных цифр листа).
 */
export function номераНаПлане(items: ЭлементТекста[], экспл: СтрокаЭкспликации[]): Подпись[] {
  const известные = new Set(экспл.map((e) => e.n));
  const out: Подпись[] = [];
  const все: Array<{ s: string; x: number; y: number; size: number }> = [];
  for (const row of строкиТекста(items)) for (const c of row) if (/^\d{1,2}$/.test(c.s)) все.push(c);
  const размеры = все.map((c) => c.size).sort((a, b) => a - b);
  const типичный = размеры.length ? размеры[Math.floor(размеры.length / 2)] : 0;
  for (const row of строкиТекста(items)) {
    for (const c of row) {
      if (!/^[1-9]\d?$/.test(c.s)) continue; // «02» в штампе листа — номер листа, не помещения
      // строка таблицы — имя стоит РЯДОМ справа от номера (в пределах 12 размеров шрифта);
      // легенда или подпись на той же базовой линии далеко слева/справа номер не отменяет
      // (design-project: «1» на плане делил линию с текстом легенды и терялся)
      const таблица = row.some((o) => o !== c && ИМЯ_ПОМЕЩЕНИЯ.test(o.s) && o.x > c.x && o.x - c.x <= 12 * c.size);
      if (таблица) continue;
      if (!известные.has(Number(c.s))) continue;
      if (типичный > 0 && c.size < 0.8 * типичный) continue; // степень у «м²»
      out.push({ text: c.s, x: c.x + c.size * 0.3, y: c.y + c.size * 0.35 });
    }
  }
  return out;
}

/** Имена и типы комнат по номерам на плане и экспликации; areas — площади по чертежу. */
export function назначенияПоНомерам(
  номера: Подпись[],
  экспл: СтрокаЭкспликации[],
  originPt: { x: number; y: number },
  metersPerPt: number,
  roomAt: (x: number, y: number) => number | null,
  /** площадь комнаты по модели, м² — сверка с экспликацией: расхождение больше чем втрое
   *  значит, что номер попал не в свою область (OTDL: «Коридор» 6,45 м² лёг в поле листа 227 м²) */
  roomArea?: (room: number) => number | undefined,
): { types: Record<number, RoomType>; names: Record<number, string>; areas: Record<number, number>; unplaced: string[] } {
  const types: Record<number, RoomType> = {}, names: Record<number, string> = {}, areas: Record<number, number> = {};
  const unplaced: string[] = [];
  const поНомеру = new Map(экспл.map((e) => [e.n, e]));
  for (const l of номера) {
    const строка = поНомеру.get(Number(l.text)); if (!строка) continue;
    const x = (l.x - originPt.x) * metersPerPt, y = (l.y - originPt.y) * metersPerPt;
    // номер на плане стоит в кружке: кружок — замкнутый контур, и сама точка номера ни в
    // одной комнате не лежит. Ищем ближайшую комнату по кругу до 0.6 м (радиус кружка ~0.25 м)
    let room = roomAt(x, y);
    for (let r = 0.15; room === null && r <= 0.6; r += 0.15) for (let a = 0; a < 360 && room === null; a += 30) room = roomAt(x + r * Math.cos((a * Math.PI) / 180), y + r * Math.sin((a * Math.PI) / 180));
    if (room === null || names[room] !== undefined) { unplaced.push(`${строка.n} ${строка.name}`); continue; }
    const m = roomArea?.(room);
    if (строка.area !== undefined && m !== undefined && (m > 3 * строка.area || m < строка.area / 3)) { unplaced.push(`${строка.n} ${строка.name}`); continue; }
    names[room] = строка.name;
    const t = roomTypeFromLabel(строка.name); if (t) types[room] = t;
    if (строка.area !== undefined) areas[room] = строка.area;
  }
  return { types, names, areas, unplaced };
}
